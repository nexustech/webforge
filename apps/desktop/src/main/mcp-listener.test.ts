import { request } from "node:http";
import { networkInterfaces } from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, describe, expect, it } from "vitest";
import { MCP_HOST, MCP_PATH, type McpListener, startMcpListener } from "./mcp-listener.js";
import { createMcpServer, type McpApp } from "./mcp-server.js";

const CLAUDE: McpApp = { id: "app-1", name: "Claude" };
const CURSOR: McpApp = { id: "app-2", name: "Cursor" };
const KEYS: Readonly<Record<string, McpApp>> = {
  ["c".repeat(43)]: CLAUDE,
  ["d".repeat(43)]: CURSOR,
};

let listener: McpListener;
afterEach(async () => {
  await listener.close();
});

async function start(): Promise<McpListener> {
  listener = await startMcpListener({
    port: 0,
    authenticate: async (key) => (Object.hasOwn(KEYS, key) ? KEYS[key] : undefined),
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
}): Promise<{ readonly status: number; readonly session: string | undefined }> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: options.address ?? MCP_HOST,
        port: listener.port,
        path: options.path ?? MCP_PATH,
        method: "POST",
        headers: {
          host: options.host ?? `${MCP_HOST}:${listener.port}`,
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          ...options.headers,
        },
      },
      (res) => {
        res.resume();
        res.on("end", () => {
          const session = res.headers["mcp-session-id"];
          resolve({
            status: res.statusCode ?? 0,
            session: typeof session === "string" ? session : undefined,
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
