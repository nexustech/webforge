import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { BRIDGE_ENV } from "@webforge/mcp-bridge";
import { buildBridge } from "@webforge/mcp-bridge/build";
import { scaledTestTimeout } from "@webforge/test-utils/vitest";
import { Ajv } from "ajv";
import { unzipSync } from "fflate";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createClaudeExtensions, extensionManifest } from "./claude-extension.js";
import { MCP_HOST, MCP_PATH, type McpListener, startMcpListener } from "./mcp-listener.js";
import { createMcpServer, type McpApp } from "./mcp-server.js";

const CLAUDE: McpApp = { id: "0b0c8f4e-2a6d-4c1e-9e10-3f6b1b2c4d5e", name: "Claude Desktop" };
const KEY = "k".repeat(43);
const PROOF = "p".repeat(43);

let dir: string;
let bridgeFile: string;
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "webforge-extension-"));
  bridgeFile = join(dir, "bridge", "webforge-bridge.mjs");
  await buildBridge(bridgeFile);
  // Bundling the bridge takes a few seconds when the run is busy.
}, scaledTestTimeout(60_000));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

/** The extensions, written under the test's folder, with what opening and showing were asked. */
function extensions(opened: string = "") {
  const open = vi.fn(async () => opened);
  const show = vi.fn();
  return {
    open,
    show,
    extensions: createClaudeExtensions({
      dir: join(dir, "ai-apps"),
      bridgeFile,
      version: "1.2.3",
      open,
      show,
    }),
  };
}

/** An extension's manifest, as far as these tests read it. */
type Manifest = {
  readonly server: {
    readonly mcp_config: {
      readonly command: string;
      readonly args: readonly string[];
      readonly env: Readonly<Record<string, string>>;
    };
  };
  readonly user_config: Readonly<Record<string, { readonly required?: boolean }>>;
};

/** Whether `manifest` passes the MCPB manifest schema, version 0.3 (`./mcpb/README.md`). */
function validManifest(manifest: unknown) {
  const schema: unknown = JSON.parse(
    readFileSync(new URL("./mcpb/manifest-v0.3.schema.json", import.meta.url), "utf8"),
  );
  const validate = new Ajv({ allErrors: true, strict: false, validateFormats: false }).compile(
    schema as object,
  );
  return validate(manifest) ? [] : (validate.errors ?? []);
}

/**
 * The command Claude Desktop runs for `manifest` installed at `target` with `userConfig`: its
 * `${__dirname}` and `${user_config.…}` filled in, as MCPB hosts do.
 */
function commandOf(
  manifest: Manifest,
  target: string,
  userConfig: Readonly<Record<string, string>>,
) {
  const fill = (value: string) =>
    value
      .replaceAll("${__dirname}", target)
      .replace(/\$\{user_config\.([a-z_]+)\}/g, (_, name: string) => userConfig[name] ?? "");
  const { command, args, env } = manifest.server.mcp_config;
  return {
    command,
    args: args.map(fill),
    env: Object.fromEntries(Object.entries(env).map(([name, value]) => [name, fill(value)])),
  };
}

/** The `.mcpb` at `file`, unpacked into a folder of its own, as Claude Desktop installs it. */
function unpack(file: string) {
  const target = mkdtempSync(join(dir, "installed-"));
  for (const [name, bytes] of Object.entries(unzipSync(readFileSync(file)))) {
    mkdirSync(dirname(join(target, name)), { recursive: true });
    writeFileSync(join(target, name), bytes);
  }
  const manifest = JSON.parse(readFileSync(join(target, "manifest.json"), "utf8")) as Manifest;
  return { target, manifest };
}

describe("Claude Desktop's extension (ADR 0021)", () => {
  it("is a valid MCPB extension, with the address, app and proof, and the key its one sensitive setting", async () => {
    const { extensions: written, open, show } = extensions();
    const pairing = { appId: CLAUDE.id, address: "http://127.0.0.1:51234/mcp", proof: PROOF };

    const { file, outcome } = await written.install(pairing);

    expect(outcome).toBe("opened");
    expect(open).toHaveBeenCalledWith(file);
    expect(show).not.toHaveBeenCalled();
    expect(file.startsWith(join(dir, "ai-apps", CLAUDE.id) + sep)).toBe(true);
    const { target, manifest } = unpack(file);
    expect(validManifest(manifest)).toEqual([]);
    // The schema does check: a manifest of another version, or without its server, fails it.
    expect(validManifest({ ...manifest, manifest_version: "9.9" })).not.toEqual([]);
    expect(validManifest({ ...manifest, server: undefined })).not.toEqual([]);
    expect(manifest).toEqual(extensionManifest(pairing, "1.2.3"));
    expect(manifest.server.mcp_config.env).toMatchObject({
      [BRIDGE_ENV.address]: pairing.address,
      [BRIDGE_ENV.app]: CLAUDE.id,
      [BRIDGE_ENV.proof]: PROOF,
      [BRIDGE_ENV.key]: "${user_config.key}",
    });
    expect(manifest.user_config).toEqual({
      key: expect.objectContaining({ type: "string", sensitive: true, required: true }),
    });
    // The bridge in it is the bundled one, as it is.
    expect(readFileSync(join(target, "server", "index.mjs"))).toEqual(readFileSync(bridgeFile));
  });

  it("shows the file in its folder when nothing opens it, and is deleted with its app", async () => {
    const { extensions: written, show } = extensions("No application is associated");
    const pairing = { appId: CLAUDE.id, address: "http://127.0.0.1:51234/mcp", proof: PROOF };

    const { file, outcome } = await written.install(pairing);

    expect(outcome).toBe("shown");
    expect(show).toHaveBeenCalledWith(file);
    await written.remove(CLAUDE.id);
    expect(() => readFileSync(file)).toThrow();
  });

  it(
    "connects Claude to Webforge once installed with the key, as Claude Desktop runs it",
    async () => {
      const listener: McpListener = await startMcpListener({
        port: 0,
        authenticate: async (key) => (key === KEY ? CLAUDE : undefined),
        proofOf: async (id) => (id === CLAUDE.id ? PROOF : null),
        serverFor: (app) =>
          createMcpServer({ name: "Webforge", version: "1" }, app, async () => ({
            status: "done",
            data: {},
          })),
      });
      cleanups.push(() => listener.close());
      const { extensions: written } = extensions();
      const { file } = await written.install({
        appId: CLAUDE.id,
        address: `http://${MCP_HOST}:${listener.port}${MCP_PATH}`,
        proof: PROOF,
      });
      const { target, manifest } = unpack(file);

      // What Claude Desktop runs: the manifest's command, its variables filled in.
      const config = commandOf(manifest, target, { key: KEY });
      expect(config.command).toBe("node");
      expect(config.args).toEqual([`${target}/server/index.mjs`]);
      expect(config.env[BRIDGE_ENV.key]).toBe(KEY);
      const client = new Client({ name: "Claude", version: "1" });
      await client.connect(
        new StdioClientTransport({
          // Claude Desktop's own Node.js; here, the one running the tests.
          command: process.execPath,
          args: config.args,
          env: config.env,
        }),
      );
      cleanups.push(() => client.close());

      expect((await client.listTools()).tools.length).toBeGreaterThan(0);
      expect(listener.connectedApps()).toEqual([CLAUDE.id]);
      // Starting Node takes a few seconds when the run is busy.
    },
    scaledTestTimeout(30_000),
  );
});
