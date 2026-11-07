import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { scaledTestTimeout } from "@webforge/test-utils/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { runBridge } from "./bridge.js";
import { buildBridge } from "./build.js";
import { BRIDGE_ENV, type BridgeConfig, configFromEnv } from "./config.js";
import {
  APP,
  KEY,
  MESSAGES,
  PROOF,
  type ProofMode,
  startTestServer,
} from "./test-server.test-helper.js";

const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

const configFor = (address: string, key: string | null = KEY): BridgeConfig => ({
  address,
  app: APP,
  proof: PROOF,
  key,
  messages: MESSAGES,
});

async function serve(mode?: ProofMode) {
  const server = await startTestServer(mode);
  cleanups.push(server.close);
  return server;
}

/** The bridge in this process, with a stdin to write JSON-RPC lines to and its answers. */
function bridge(config: BridgeConfig) {
  const input = new PassThrough();
  const output = new PassThrough();
  const answers: unknown[] = [];
  let buffered = "";
  output.on("data", (chunk: Buffer) => {
    buffered += chunk.toString("utf8");
    const lines = buffered.split("\n");
    buffered = lines.pop() ?? "";
    for (const line of lines) answers.push(JSON.parse(line));
  });
  const running = runBridge({ input, output, config });
  cleanups.push(() => {
    input.end();
    return running;
  });
  return {
    send: (...messages: unknown[]) => {
      for (const message of messages) input.write(`${JSON.stringify(message)}\n`);
    },
    /** Writes a line as it is. */
    raw: (line: string) => input.write(`${line}\n`),
    answers,
    /** Ends stdin, and waits for every message to be answered. */
    done: async () => {
      input.end();
      await running;
      return answers;
    },
  };
}

const initialize = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "test", version: "1.0.0" },
  },
};
const initialized = { jsonrpc: "2.0", method: "notifications/initialized" };
const listTools = (id: number) => ({ jsonrpc: "2.0", id, method: "tools/list" });

/** A port nothing listens on. */
async function freePort() {
  const probe = createServer();
  await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const { port } = probe.address() as { port: number };
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  return port;
}

describe("the bridge (ADR 0021)", () => {
  it(
    "relays a stdio client's MCP to Webforge, the key in its header, once bundled",
    async () => {
      const server = await serve();
      const dir = mkdtempSync(join(tmpdir(), "webforge-bridge-"));
      cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
      const file = join(dir, "index.mjs");
      await buildBridge(file);

      const client = new Client({ name: "Claude", version: "1.0.0" });
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [file],
        env: {
          [BRIDGE_ENV.address]: server.address,
          [BRIDGE_ENV.app]: APP,
          [BRIDGE_ENV.proof]: PROOF,
          // As pasted, with a line break after it.
          [BRIDGE_ENV.key]: `${KEY}\n`,
          [BRIDGE_ENV.messages]: JSON.stringify(MESSAGES),
        },
        stderr: "pipe",
      });
      let stderr = "";
      transport.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });
      await client.connect(transport);
      cleanups.push(() => client.close());

      expect((await client.listTools()).tools.map(({ name }) => name)).toEqual(["echo"]);
      const called = await client.callTool({ name: "echo", arguments: { text: "Hello" } });
      expect(called.content).toEqual([{ type: "text", text: '{"text":"Hello"}' }]);
      // Every message went with the key, each after a challenge without it.
      const keyed = server.seen.filter(({ path }) => path === "/mcp");
      expect(keyed.length).toBeGreaterThanOrEqual(3);
      expect(keyed.every(({ authorization }) => authorization === `Bearer ${KEY}`)).toBe(true);
      const challenges = server.seen.filter(({ path }) => path === "/mcp/proof");
      expect(challenges).toHaveLength(keyed.length);
      expect(challenges.every(({ authorization }) => authorization === undefined)).toBe(true);
      // It logs nothing.
      expect(stderr).toBe("");
      // Bundling the bridge and starting Node take a few seconds when the run is busy.
    },
    scaledTestTimeout(30_000),
  );

  it("tells the app when Webforge doesn't take the key", async () => {
    const server = await serve();
    const relay = bridge(configFor(server.address, "w".repeat(43)));
    relay.send(initialize);

    expect(await relay.done()).toEqual([
      { jsonrpc: "2.0", id: 1, error: { code: -32000, message: MESSAGES.keyRefused } },
    ]);
  });

  it("sends nothing at all without a key", async () => {
    const server = await serve();
    const relay = bridge(configFor(server.address, null));
    relay.send(initialize, initialized);

    expect(await relay.done()).toEqual([
      { jsonrpc: "2.0", id: 1, error: { code: -32000, message: MESSAGES.keyRefused } },
    ]);
    expect(server.seen).toEqual([]);
  });

  it.each([
    ["doesn't know the proof", "wrong"],
    ["passes the challenge on to Webforge at another port", "other-port"],
  ] as const)("sends no key and no message to a server that %s", async (_, mode) => {
    const server = await serve(mode);
    const relay = bridge(configFor(server.address));
    relay.send(initialize, listTools(2));

    expect(await relay.done()).toEqual([
      { jsonrpc: "2.0", id: 1, error: { code: -32000, message: MESSAGES.notWebforge } },
      { jsonrpc: "2.0", id: 2, error: { code: -32000, message: MESSAGES.notWebforge } },
    ]);
    expect(server.seen.map(({ path }) => path)).toEqual(["/mcp/proof", "/mcp/proof"]);
    expect(server.seen.every(({ authorization }) => authorization === undefined)).toBe(true);
  });

  it("never sends the key on a connection other than the one it checked", async () => {
    const server = await serve("close");
    const relay = bridge(configFor(server.address));
    relay.send(initialize);

    expect(await relay.done()).toEqual([
      { jsonrpc: "2.0", id: 1, error: { code: -32000, message: MESSAGES.unreachable } },
    ]);
    expect(server.seen.map(({ path }) => path)).toEqual(["/mcp/proof"]);
  });

  it("tells the app when nothing answers: Webforge is closed, or AI apps is off", async () => {
    const relay = bridge(configFor(`http://127.0.0.1:${await freePort()}/mcp`));
    relay.send(initialize, initialized);

    expect(await relay.done()).toEqual([
      { jsonrpc: "2.0", id: 1, error: { code: -32000, message: MESSAGES.unreachable } },
    ]);
  });

  it("starts a new session, unseen by the app, when Webforge has ended its own", async () => {
    const server = await serve();
    const relay = bridge(configFor(server.address));
    relay.send(initialize, initialized);
    await expect.poll(() => relay.answers.length).toBe(1);

    server.endSessions();
    relay.send({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "echo", arguments: { n: 1 } },
    });
    relay.send(listTools(3));

    const answers = await relay.done();
    // The app's own initialize is answered once, and its call reaches the new session once.
    expect(answers.filter((each) => (each as { id?: number }).id === 1)).toHaveLength(1);
    expect(answers).toContainEqual({
      jsonrpc: "2.0",
      id: 2,
      result: { content: [{ type: "text", text: '{"n":1}' }] },
    });
    expect(answers).toContainEqual(expect.objectContaining({ id: 3, result: expect.anything() }));
    expect(server.calls()).toBe(1);
  });

  it("answers a line that isn't JSON with a parse error, and carries on", async () => {
    const server = await serve();
    const relay = bridge(configFor(server.address));
    relay.send(initialize);
    await expect.poll(() => relay.answers.length).toBe(1);
    relay.raw("{not json");

    const answers = await relay.done();
    expect(answers[1]).toEqual({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    });
  });
});

describe("the bridge's settings", () => {
  const env = {
    [BRIDGE_ENV.address]: "http://127.0.0.1:51234/mcp",
    [BRIDGE_ENV.app]: APP,
    [BRIDGE_ENV.proof]: PROOF,
    [BRIDGE_ENV.key]: ` ${KEY} `,
    [BRIDGE_ENV.messages]: JSON.stringify(MESSAGES),
  };

  it("reads them from the environment, the pasted key trimmed", () => {
    expect(configFromEnv(env)).toEqual(configFor("http://127.0.0.1:51234/mcp"));
  });

  it("takes a missing or malformed key as none", () => {
    expect(configFromEnv({ ...env, [BRIDGE_ENV.key]: undefined })?.key).toBeNull();
    expect(configFromEnv({ ...env, [BRIDGE_ENV.key]: "not a key" })?.key).toBeNull();
  });

  it.each([
    ["an address that isn't loopback's", { [BRIDGE_ENV.address]: "http://example.com:1/mcp" }],
    ["localhost, not the literal address", { [BRIDGE_ENV.address]: "http://localhost:1/mcp" }],
    ["no app", { [BRIDGE_ENV.app]: undefined }],
    ["a short proof", { [BRIDGE_ENV.proof]: "short" }],
    ["messages that aren't JSON", { [BRIDGE_ENV.messages]: "{" }],
    ["a message missing", { [BRIDGE_ENV.messages]: JSON.stringify({ failed: "x" }) }],
  ])("refuses %s", (_, change) => {
    expect(configFromEnv({ ...env, ...change })).toBeUndefined();
  });
});
