import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { AI_TOOLS } from "@webforge/commands";
import { t } from "@webforge/i18n";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiResponse } from "../shared/ipc/ai.js";
import { APP_TOOLS } from "../shared/ipc/ai.js";
import { MCP_HOST, MCP_PATH } from "./mcp-address.js";
import { type McpListener, startMcpListener } from "./mcp-listener.js";
import { createMcpServer, type McpApp } from "./mcp-server.js";
import { MAIN_TOOLS } from "./site-brief.js";

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
    proofOf: async () => null,
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

describe("the MCP server's prompt (4.12b, AIB-8)", () => {
  it("offers Build a site from a description, in the order that builds one", async () => {
    const client = await inMemory();

    expect((await client.listPrompts()).prompts).toEqual([
      expect.objectContaining({
        name: "build-site-from-description",
        title: "Build a site from a description",
        arguments: [expect.objectContaining({ name: "description", required: false })],
      }),
    ]);
    const prompt = await client.getPrompt({
      name: "build-site-from-description",
      arguments: { description: "A site for my garage, Rapidfix Vehicle Repair, in red." },
    });
    const [message] = prompt.messages;
    const text = message?.content.type === "text" ? message.content.text : "";
    expect(message?.role).toBe("user");
    expect(text).toContain(`Build a website in ${t("app.name")} from this description:`);
    expect(text).toContain("Rapidfix Vehicle Repair, in red.");
    // The tools in order: a brief (and its status), the catalogue, one plan, Site Check, the
    // preview, then what stays with the person.
    const order = [
      "createSiteFromBrief",
      "briefStatus",
      "catalogue",
      "one plan",
      "runSiteCheck",
      "requestMedia",
      "openPreview",
      "publishing",
    ].map((word) => text.indexOf(word));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("asks for the description when none is given, and has no other prompt", async () => {
    const client = await inMemory();
    const prompt = await client.getPrompt({ name: "build-site-from-description" });
    const [message] = prompt.messages;
    expect(message?.content.type === "text" ? message.content.text : "").toMatch(
      /^Build a website in .+ for my business\. Ask me /,
    );
    await expect(client.getPrompt({ name: "anything-else" })).rejects.toThrow();
  });
});

describe("the MCP server (4.9)", () => {
  it("lists every AI tool, the same through either transport (AIA-4)", async () => {
    const memory = await (await inMemory()).listTools();
    const http = await (await overHttp()).listTools();

    expect(memory.tools.map((tool) => tool.name)).toEqual([
      ...AI_TOOLS.map((tool) => tool.name),
      ...Object.keys(APP_TOOLS),
      "requestMedia",
      ...Object.keys(MAIN_TOOLS),
    ]);
    // requestMedia takes the app's reason: never a path or an address (4.12b).
    expect(memory.tools.find((tool) => tool.name === "requestMedia")?.inputSchema).toEqual({
      type: "object",
      properties: { reason: { type: "string", minLength: 1, maxLength: 200 } },
      required: ["reason"],
      additionalProperties: false,
    });
    // Run Site Check and Open Preview take nothing: no address, path or host.
    expect(memory.tools.find((tool) => tool.name === "openPreview")?.inputSchema).toEqual({
      type: "object",
      properties: {},
      additionalProperties: false,
    });
    expect(http.tools).toEqual(memory.tools);
    expect(memory.tools[0]?.inputSchema).toEqual(AI_TOOLS[0]?.inputSchema);
  });

  it("asks the open site for a query, and runs a command on the paired app's behalf", async () => {
    const client = await inMemory();

    const outline = await client.callTool({ name: "outline", arguments: {} });
    await client.callTool({ name: "addPage", arguments: { title: "Menu" } });

    // Each with the request's signal: a brief stops waiting when the app gives up (4.12a).
    const signal = expect.any(AbortSignal);
    expect(ask).toHaveBeenNthCalledWith(1, { kind: "query", name: "outline", input: {} }, signal);
    expect(ask).toHaveBeenNthCalledWith(
      2,
      {
        kind: "command",
        name: "addPage",
        input: { title: "Menu" },
        app: "Claude",
      },
      signal,
    );
    await client.callTool({ name: "runSiteCheck", arguments: {} });
    expect(ask).toHaveBeenNthCalledWith(
      3,
      { kind: "query", name: "runSiteCheck", input: {} },
      signal,
    );
    expect(outline).toEqual({
      content: [
        { type: "text", text: JSON.stringify({ status: "done", data: { name: "Rosa's Bakery" } }) },
      ],
    });
  });

  it("reports progress while a call waits, when the app asks to be told (4.12a)", async () => {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    // The call waits until two progress notices have reached the app, however slow the timers
    // run on a busy machine (#823), not for a fixed time.
    let finish: () => void = () => undefined;
    const slow = vi.fn(
      () =>
        new Promise<AiResponse>((resolve) => {
          finish = () => resolve({ status: "declined", message: "closed" });
        }),
    );
    await createMcpServer(INFO, CLAUDE, slow, 20).connect(serverSide);
    const client = new Client({ name: "test", version: "1" });
    await client.connect(clientSide);
    let notices = 0;
    const onprogress = vi.fn(() => {
      notices += 1;
      if (notices === 2) finish();
    });

    await client.callTool({ name: "createSiteFromBrief", arguments: {} }, undefined, {
      onprogress,
      resetTimeoutOnProgress: true,
    });

    expect(onprogress.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(onprogress).toHaveBeenCalledWith(expect.objectContaining({ progress: 1 }));
  });

  it("offers the catalogue as a resource, without asking the open site (AIB-1)", async () => {
    const client = await inMemory();

    expect((await client.listResources()).resources).toEqual([
      expect.objectContaining({ uri: "webforge://catalogue", mimeType: "application/json" }),
    ]);
    const [content] = (await client.readResource({ uri: "webforge://catalogue" })).contents;
    const catalogue = JSON.parse((content as { text: string }).text) as Record<
      string,
      { place: string; fields: Record<string, { kind: string }> }
    >;
    expect(catalogue.Hero).toMatchObject({ place: "section" });
    // Not what AI apps can't add: the Header, the Footer and Custom Code.
    expect(catalogue.Header).toBeUndefined();
    expect(
      Object.values(catalogue).some((type) =>
        Object.values(type.fields).some(({ kind }) => kind === "code"),
      ),
    ).toBe(false);
    await expect(client.readResource({ uri: "webforge://site" })).rejects.toThrow(
      "There is no such resource.",
    );
    expect(ask).not.toHaveBeenCalled();
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
