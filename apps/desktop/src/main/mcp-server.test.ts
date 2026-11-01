import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { AI_TOOLS } from "@webforge/commands";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiResponse } from "../shared/ipc/ai.js";
import { MCP_HOST, MCP_PATH, type McpListener, startMcpListener } from "./mcp-listener.js";
import { createMcpServer, type McpApp } from "./mcp-server.js";

const INFO = { name: "Webforge", version: "1.0.0" };
const CLAUDE: McpApp = { id: "app-1", name: "Claude" };
const KEY = "k".repeat(43);

const ask = vi.fn(
  async (): Promise<AiResponse> => ({ status: "done", data: { name: "Rosa's Bakery" } }),
);

/** A client connected to a server for {@link CLAUDE} through an in-memory pair (AIA-4). */
async function inMemory(): Promise<Client> {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createMcpServer(INFO, CLAUDE, ask).connect(serverSide);
  const client = new Client({ name: "test", version: "1" });
  await client.connect(clientSide);
  return client;
}

let listener: McpListener | undefined;
afterEach(async () => {
  await listener?.close();
  listener = undefined;
  ask.mockClear();
});

/** A client connected through the loopback listener, with {@link KEY} (ADR 0021). */
async function overHttp(): Promise<Client> {
  listener = await startMcpListener({
    port: 0,
    authenticate: async (key) => (key === KEY ? CLAUDE : undefined),
    serverFor: (app) => createMcpServer(INFO, app, ask),
  });
  const url = new URL(`http://${MCP_HOST}:${listener.port}${MCP_PATH}`);
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: { headers: { authorization: `Bearer ${KEY}` } },
  });
  const client = new Client({ name: "test", version: "1" });
  await client.connect(transport);
  return client;
}

describe("the MCP server (4.9)", () => {
  it("lists every AI tool, the same through either transport (AIA-4)", async () => {
    const memory = await (await inMemory()).listTools();
    const http = await (await overHttp()).listTools();

    expect(memory.tools.map((tool) => tool.name)).toEqual(AI_TOOLS.map((tool) => tool.name));
    expect(http.tools).toEqual(memory.tools);
    expect(memory.tools[0]?.inputSchema).toEqual(AI_TOOLS[0]?.inputSchema);
  });

  it("asks the open site for a query, and runs a command on the paired app's behalf", async () => {
    const client = await inMemory();

    const outline = await client.callTool({ name: "outline", arguments: {} });
    await client.callTool({ name: "addPage", arguments: { title: "Menu" } });

    expect(ask).toHaveBeenNthCalledWith(1, { kind: "query", name: "outline", input: {} });
    expect(ask).toHaveBeenNthCalledWith(2, {
      kind: "command",
      name: "addPage",
      input: { title: "Menu" },
      app: "Claude",
    });
    expect(outline).toEqual({
      content: [
        { type: "text", text: JSON.stringify({ status: "done", data: { name: "Rosa's Bakery" } }) },
      ],
    });
  });

  it("answers what didn't happen as an error, and a tool it doesn't have without asking", async () => {
    const client = await inMemory();
    ask.mockResolvedValueOnce({ status: "declined", message: "The person said no." });

    const declined = await client.callTool({ name: "setThemeTokens", arguments: { tokens: {} } });
    const unknown = await client.callTool({ name: "publish", arguments: {} });

    expect(declined.isError).toBe(true);
    expect(unknown).toMatchObject({ isError: true });
    expect(ask).toHaveBeenCalledOnce();
  });
});
