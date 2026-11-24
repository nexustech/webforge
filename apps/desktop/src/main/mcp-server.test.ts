import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { AI_TOOLS, toMcpTool } from "@webforge/commands";
import { t } from "@webforge/i18n";
import { TEMPLATE_IDS } from "@webforge/templates";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MAIN_TOOLS, WINDOW_TOOLS } from "../shared/ai-tools.js";
import { type AiResponse, ANSWER_WITHIN_MS } from "../shared/ipc/ai.js";
import { MCP_HOST, MCP_PATH } from "./mcp-address.js";
import { type McpListener, startMcpListener } from "./mcp-listener.js";
import { createAssistantMcpServer, createMcpServer, type McpApp } from "./mcp-server.js";

const INFO = { name: "Webforge", version: "1.0.0" };
const CLAUDE: McpApp = { id: "app-1", name: "Claude" };
const KEY = "k".repeat(43);
/** The tools the in-app assistant has (AIA-9): the command layer's, and Site Check. */
const ASSISTANT_TOOL_NAMES = [...AI_TOOLS.map((tool) => tool.name), "runSiteCheck"];

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
      ...WINDOW_TOOLS.map((tool) => tool.name),
      ...MAIN_TOOLS.map((tool) => tool.name),
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
    expect(memory.tools[0]?.inputSchema).toEqual(AI_TOOLS.map(toMcpTool)[0]?.inputSchema);
  });

  it("names how long each tool that answers waiting waits, as it does (#1384)", async () => {
    const tools = (await (await inMemory()).listTools()).tools;
    const waits = `about ${ANSWER_WITHIN_MS / 1000} seconds`;
    // `plan`'s words are written in the commands package, which can't read the time.
    for (const name of ["plan", "requestMedia", "createSiteFromBrief", "changeStatus"]) {
      expect(tools.find((tool) => tool.name === name)?.description).toContain(waits);
    }
    // Well within the 60 s an MCP client waits by default, so it learns the id before it gives up.
    expect(ANSWER_WITHIN_MS).toBeLessThanOrEqual(30_000);
  });

  it("lists the same tools, word for word, as before they were one definition (#981)", async () => {
    const tools = (await (await inMemory()).listTools()).tools;
    // The templates a brief chooses from are the folders' (`pnpm new-template` adds one, #983):
    // checked here, and kept out of the snapshot, so a new template doesn't change it.
    const shown = structuredClone(tools);
    const brief = shown.find((tool) => tool.name === "createSiteFromBrief")?.inputSchema;
    const template = (brief?.properties as Record<string, { enum?: unknown }> | undefined)
      ?.template;
    expect(template?.enum).toEqual([...TEMPLATE_IDS]);
    if (template !== undefined) template.enum = "TEMPLATE_IDS";
    await expect(`${JSON.stringify(shown, null, 2)}\n`).toMatchFileSnapshot(
      "./__snapshots__/mcp-tools.json.snap",
    );
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await createAssistantMcpServer(INFO, ask).connect(serverSide);
    const assistant = new Client({ name: "test", version: "1" });
    await assistant.connect(clientSide);
    // The assistant's are a few of the same (AIA-9), in the same order.
    expect((await assistant.listTools()).tools).toEqual(
      tools.filter((tool) => ASSISTANT_TOOL_NAMES.includes(tool.name)),
    );
  });

  it("asks the open site for a query, and runs a command on the paired app's behalf", async () => {
    const client = await inMemory();

    const outline = await client.callTool({ name: "outline", arguments: {} });
    await client.callTool({ name: "addPage", arguments: { title: "Menu" } });

    // Each with its tool's definition, which main routes it by (#981), and the request's signal:
    // a brief stops waiting when the app gives up (4.12a).
    const signal = expect.any(AbortSignal);
    const route = (name: string, answeredBy: string, savesVersionFirst: boolean) =>
      expect.objectContaining({ name, answeredBy, savesVersionFirst });
    expect(ask).toHaveBeenNthCalledWith(
      1,
      { kind: "query", name: "outline", input: {} },
      route("outline", "window", false),
      signal,
    );
    expect(ask).toHaveBeenNthCalledWith(
      2,
      {
        kind: "command",
        name: "addPage",
        input: { title: "Menu" },
        app: "Claude",
      },
      route("addPage", "window", true),
      signal,
    );
    await client.callTool({ name: "runSiteCheck", arguments: {} });
    expect(ask).toHaveBeenNthCalledWith(
      3,
      { kind: "query", name: "runSiteCheck", input: {} },
      route("runSiteCheck", "window", false),
      signal,
    );
    // A plan's Allow saves its version (S26); a brief is main's, and changes no open site.
    await client.callTool({ name: "plan", arguments: {} });
    await client.callTool({ name: "createSiteFromBrief", arguments: {} });
    expect(ask).toHaveBeenNthCalledWith(
      4,
      expect.anything(),
      route("plan", "window", false),
      signal,
    );
    expect(ask).toHaveBeenNthCalledWith(
      5,
      expect.anything(),
      route("createSiteFromBrief", "main", false),
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
    // Saying it may be the person it waits on, which has no time limit (5.34).
    expect(onprogress).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/may be asking the person/) }),
    );
  });

  it("offers the catalogue as a resource, without asking the open site (AIB-1)", async () => {
    const client = await inMemory();

    expect((await client.listResources()).resources).toEqual([
      expect.objectContaining({ uri: "webforge://catalogue", mimeType: "application/json" }),
    ]);
    const [content] = (await client.readResource({ uri: "webforge://catalogue" })).contents;
    const resource = JSON.parse((content as { text: string }).text) as {
      styleFields: Record<string, { kind: string }>;
      components: Record<string, { place: string; fields: Record<string, { kind: string }> }>;
    };
    const catalogue = resource.components;
    expect(catalogue.Hero).toMatchObject({ place: "section" });
    // The styling fields types share, once (#1250).
    expect(resource.styleFields.lookFont).toMatchObject({ kind: expect.any(String) });
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
