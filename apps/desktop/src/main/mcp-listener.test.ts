import { request } from "node:http";
import { networkInterfaces } from "node:os";
import { PassThrough } from "node:stream";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { PROOF_PATH, proofFor, runBridge } from "@webforge/mcp-bridge";
import { afterEach, describe, expect, it } from "vitest";
import {
  MAX_SESSIONS_PER_APP,
  MCP_HOST,
  MCP_PATH,
  type McpListener,
  SESSION_IDLE_MS,
  startMcpListener,
} from "./mcp-listener.js";
import { createMcpServer, type McpApp } from "./mcp-server.js";

const CLAUDE: McpApp = { id: "app-1", name: "Claude" };
const CURSOR: McpApp = { id: "app-2", name: "Cursor" };
const KEYS: Readonly<Record<string, McpApp>> = {
  ["c".repeat(43)]: CLAUDE,
  ["d".repeat(43)]: CURSOR,
};
/** Each app's server proof, which its bridge checks the server by. */
const PROOFS: Readonly<Record<string, string>> = {
  [CLAUDE.id]: "p".repeat(43),
  [CURSOR.id]: "q".repeat(43),
};

let listener: McpListener;
/** The listener's time, which a test moves on. */
let time = 0;
afterEach(async () => {
  await listener.close();
  time = 0;
});

async function start(): Promise<McpListener> {
  listener = await startMcpListener({
    port: 0,
    now: () => time,
    authenticate: async (key) => (Object.hasOwn(KEYS, key) ? KEYS[key] : undefined),
    proofOf: async (id) => PROOFS[id] ?? null,
    serverFor: (app) =>
      createMcpServer({ name: "Webforge", version: "1" }, app, async () => ({
        status: "done",
        data: {},
      })),
  });
  return listener;
}

const INITIALIZE = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "test", version: "1" },
  },
});

/** What `127.0.0.1:<port>` answers a raw request: its status and session id. */
function send(options: {
  readonly host?: string;
  readonly address?: string;
  readonly path?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly method?: string;
}): Promise<{
  readonly status: number;
  readonly session: string | undefined;
  readonly body: string;
}> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: options.address ?? MCP_HOST,
        port: listener.port,
        path: options.path ?? MCP_PATH,
        method: options.method ?? "POST",
        headers: {
          host: options.host ?? `${MCP_HOST}:${listener.port}`,
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          ...options.headers,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const session = res.headers["mcp-session-id"];
          resolve({
            status: res.statusCode ?? 0,
            session: typeof session === "string" ? session : undefined,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    req.on("error", reject);
    req.end(options.body ?? INITIALIZE);
  });
}

const as = (key: string) => ({ authorization: `Bearer ${key}` });
const claude = as("c".repeat(43));

describe("the MCP server's loopback listener (ADR 0021)", () => {
  it("starts a connection for a paired app's key, on the literal 127.0.0.1", async () => {
    await start();
    const answer = await send({ headers: claude });

    expect(answer.status).toBe(200);
    expect(answer.session).toBeTypeOf("string");
    expect(listener.connectedApps()).toEqual([CLAUDE.id]);
  });

  it("refuses a browser page, any other Host, and any other path, before asking who it is", async () => {
    await start();

    expect((await send({ headers: { ...claude, origin: "https://example.com" } })).status).toBe(
      403,
    );
    expect((await send({ headers: { ...claude, origin: "null" } })).status).toBe(403);
    expect((await send({ headers: claude, host: `localhost:${listener.port}` })).status).toBe(403);
    expect((await send({ headers: claude, host: "127.0.0.1" })).status).toBe(403);
    expect((await send({ headers: claude, path: "/" })).status).toBe(404);
    expect(listener.connectedApps()).toEqual([]);
  });

  it("refuses an unpaired caller, a key anywhere but Authorization, and one too short", async () => {
    await start();

    expect((await send({})).status).toBe(401);
    expect((await send({ headers: as("x".repeat(43)) })).status).toBe(401);
    expect((await send({ headers: { authorization: `Basic ${"c".repeat(43)}` } })).status).toBe(
      401,
    );
    expect((await send({ headers: as("c".repeat(20)) })).status).toBe(401);
    expect((await send({ path: `${MCP_PATH}?key=${"c".repeat(43)}` })).status).toBe(401);
  });

  it("refuses a body over its cap, one that isn't JSON, and anything but initialize to start", async () => {
    await start();

    expect((await send({ headers: claude, body: "x".repeat(2_000_000) })).status).toBe(413);
    expect((await send({ headers: claude, body: "{" })).status).toBe(400);
    const list = JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    expect((await send({ headers: claude, body: list })).status).toBe(400);
  });

  it("keeps each app's connection its own, and cuts off a removed app", async () => {
    await start();
    const { session } = await send({ headers: claude });
    if (session === undefined) throw new Error("no session");
    const list = JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" });

    // Another paired app can't use Claude's connection.
    const cursor = { ...as("d".repeat(43)), "mcp-session-id": session };
    expect((await send({ headers: cursor, body: list })).status).toBe(404);

    await listener.disconnect(CLAUDE.id);
    expect(listener.connectedApps()).toEqual([]);
    expect(
      (await send({ headers: { ...claude, "mcp-session-id": session }, body: list })).status,
    ).toBe(404);
  });

  it("keeps at most a few connections per app, ending the least recently used", async () => {
    await start();
    const list = JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    const sessions: string[] = [];
    for (let n = 0; n <= MAX_SESSIONS_PER_APP; n++) {
      time += 1_000;
      const { session } = await send({ headers: claude });
      if (session === undefined) throw new Error("no session");
      sessions.push(session);
    }
    const cursor = await send({ headers: as("d".repeat(43)) });

    const reached = async (id: string, headers = claude) =>
      (await send({ headers: { ...headers, "mcp-session-id": id }, body: list })).status;
    expect(await reached(sessions[0] ?? "")).toBe(404);
    for (const id of sessions.slice(1)) expect(await reached(id)).not.toBe(404);
    // Another app's connections don't count against Claude's.
    expect(await reached(cursor.session ?? "", as("d".repeat(43)))).not.toBe(404);
  });

  it("ends a connection left unused, as a crashed client leaves it, and says so", async () => {
    await start();
    const { session } = await send({ headers: claude });
    expect(listener.connectedApps()).toEqual([CLAUDE.id]);

    time += SESSION_IDLE_MS;

    expect(listener.connectedApps()).toEqual([]);
    const list = JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    const after = await send({
      headers: { ...claude, "mcp-session-id": session ?? "" },
      body: list,
    });
    expect(after.status).toBe(404);
  });

  it("can't be reached from another computer: only 127.0.0.1 listens", async () => {
    await start();
    const others = Object.values(networkInterfaces())
      .flat()
      .filter((address) => address !== undefined && address.family === "IPv4" && !address.internal)
      .map((address) => address?.address ?? "");

    for (const address of others) {
      await expect(send({ address, headers: claude })).rejects.toThrow();
    }
  });

  it("serves an MCP client that sends its key in the header", async () => {
    await start();
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://${MCP_HOST}:${listener.port}${MCP_PATH}`),
      { requestInit: { headers: claude } },
    );
    const client = new Client({ name: "test", version: "1" });
    await client.connect(transport);

    expect((await client.listTools()).tools.length).toBeGreaterThan(0);
    await client.close();
  });
});

describe("the listener's proof, which a bridge checks before it sends its key (ADR 0021)", () => {
  const nonce = "n".repeat(43);
  const challenge = (app: string, headers: Readonly<Record<string, string>> = {}) =>
    send({ path: PROOF_PATH, headers, body: JSON.stringify({ app, nonce }) });

  it("answers a challenge with the HMAC of its nonce and address under the app's proof, keyless", async () => {
    await start();
    const host = `${MCP_HOST}:${listener.port}`;

    const answer = await challenge(CLAUDE.id);

    expect(answer.status).toBe(200);
    expect(JSON.parse(answer.body)).toEqual({
      proof: proofFor(PROOFS[CLAUDE.id] ?? "", host, nonce),
    });
    // Another app's is its own.
    expect(JSON.parse((await challenge(CURSOR.id)).body)).toEqual({
      proof: proofFor(PROOFS[CURSOR.id] ?? "", host, nonce),
    });
    expect(listener.connectedApps()).toEqual([]);
  });

  it("answers an unknown app's under a decoy, which tells nothing of which apps there are", async () => {
    await start();
    const host = `${MCP_HOST}:${listener.port}`;

    const answer = await challenge("app-unknown");

    expect(answer.status).toBe(200);
    const { proof } = JSON.parse(answer.body) as { proof: string };
    expect(proof).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Object.values(PROOFS).map((each) => proofFor(each, host, nonce))).not.toContain(proof);
  });

  it("checks a challenge as every request: Origin, Host, method, size and shape", async () => {
    await start();
    const body = JSON.stringify({ app: CLAUDE.id, nonce });

    expect((await challenge(CLAUDE.id, { origin: "https://example.com" })).status).toBe(403);
    expect(
      (await send({ path: PROOF_PATH, host: `localhost:${listener.port}`, body })).status,
    ).toBe(403);
    expect((await send({ path: PROOF_PATH, method: "PUT", body })).status).toBe(405);
    expect((await send({ path: PROOF_PATH, body: "{" })).status).toBe(400);
    expect(
      (await send({ path: PROOF_PATH, body: JSON.stringify({ app: CLAUDE.id, nonce: "short" }) }))
        .status,
    ).toBe(400);
    expect(
      (await send({ path: PROOF_PATH, body: JSON.stringify({ app: "x".repeat(2000), nonce }) }))
        .status,
    ).toBe(413);
  });

  it("lets a bridge with the app's key and proof through, its tools listed", async () => {
    await start();
    const input = new PassThrough();
    const output = new PassThrough();
    const lines: string[] = [];
    output.on("data", (chunk: Buffer) => lines.push(...chunk.toString("utf8").split("\n")));
    const running = runBridge({
      input,
      output,
      config: {
        address: `http://${MCP_HOST}:${listener.port}${MCP_PATH}`,
        app: CLAUDE.id,
        proof: PROOFS[CLAUDE.id] ?? "",
        key: "c".repeat(43),
        messages: { unreachable: "u", notWebforge: "n", keyRefused: "k", failed: "f" },
      },
    });
    input.write(`${INITIALIZE}\n`);
    input.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
    input.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" })}\n`);
    input.end();
    await running;

    const answers = lines.filter((line) => line !== "").map((line) => JSON.parse(line));
    expect(answers.map(({ id }) => id)).toEqual([1, 2]);
    expect(answers[1].result.tools.length).toBeGreaterThan(0);
    expect(listener.connectedApps()).toEqual([CLAUDE.id]);
  });
});
