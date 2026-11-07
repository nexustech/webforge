import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  type CallToolResult,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  AI_TOOLS,
  CATALOGUE_RESOURCE,
  catalogueResourceText,
  UNTRUSTED_SITE_TEXT,
} from "@webforge/commands";
import { type AiRequest, type AiResponse, APP_TOOLS } from "../shared/ipc/ai.js";

/** An AI app the person paired (4.9): its id, and the name they gave it, never its own. */
export type McpApp = { readonly id: string; readonly name: string };

/** What the server says it is to an AI app: Webforge, by the name the build has, and its version. */
export type McpServerInfo = { readonly name: string; readonly version: string };

/**
 * Every tool an AI app sees: the command layer's (`AI_TOOLS`), then those the window answers
 * itself (`APP_TOOLS`), each a query, taking nothing.
 */
const TOOLS = [
  ...AI_TOOLS,
  ...Object.entries(APP_TOOLS).map(([name, description]) => ({
    kind: "query" as const,
    name,
    description: `${description} ${UNTRUSTED_SITE_TEXT}`,
    inputSchema: { type: "object" as const, properties: {}, additionalProperties: false },
  })),
];

/** The catalogue resource's content (AIB-1): the same for every connection, made once. */
let catalogueText: string | undefined;

/** A tool's answer: the bridge's response as JSON, in labelled fields; an error unless done. */
function toolResult(response: AiResponse): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(response) }],
    ...(response.status === "done" ? {} : { isError: true }),
  };
}

/**
 * The MCP server for one connection of `app` (4.9, AIA-4): {@link TOOLS} as its tools, each call
 * asked of the open site through `ask`, a command on `app`'s behalf; and the catalogue as its one
 * resource (AIB-1), which is Webforge's, not the site's, so needs no site open. It holds no state of its own,
 * so any transport can carry it: the loopback HTTP one for AI apps (ADR 0021), or an in-memory one
 * for an in-app assistant. Nothing of a call or its answer is logged, the SDK's errors included.
 */
export function createMcpServer(
  info: McpServerInfo,
  app: McpApp,
  ask: (request: AiRequest) => Promise<AiResponse>,
): Server {
  const server = new Server(info, { capabilities: { tools: {}, resources: {} } });
  // The SDK reports a transport's or handler's errors here; they may quote a request.
  server.onerror = () => undefined;
  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: TOOLS.map(({ name, description, inputSchema }) => ({
      name,
      description,
      inputSchema,
    })),
  }));
  server.setRequestHandler(ListResourcesRequestSchema, () => ({
    resources: [CATALOGUE_RESOURCE],
  }));
  server.setRequestHandler(ReadResourceRequestSchema, ({ params }) => {
    if (params.uri !== CATALOGUE_RESOURCE.uri) {
      throw new McpError(ErrorCode.InvalidParams, "There is no such resource.");
    }
    catalogueText ??= catalogueResourceText();
    return {
      contents: [
        { uri: CATALOGUE_RESOURCE.uri, mimeType: CATALOGUE_RESOURCE.mimeType, text: catalogueText },
      ],
    };
  });
  server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
    const tool = TOOLS.find((each) => each.name === params.name);
    if (tool === undefined) {
      return toolResult({ status: "invalid", message: "There is no such tool." });
    }
    const input = params.arguments ?? {};
    return toolResult(
      await ask(
        tool.kind === "query"
          ? { kind: "query", name: tool.name, input }
          : { kind: "command", name: tool.name, input, app: app.name },
      ),
    );
  });
  return server;
}
