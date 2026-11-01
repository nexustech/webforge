import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  type CallToolResult,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { AI_TOOLS } from "@webforge/commands";
import type { AiResponse } from "../shared/ipc/ai.js";
import type { AiBridge } from "./ai-ipc.js";

/** An AI app the person paired (4.9): its id, and the name they gave it, never its own. */
export type McpApp = { readonly id: string; readonly name: string };

/** What the server says it is to an AI app: Webforge, by the name the build has, and its version. */
export type McpServerInfo = { readonly name: string; readonly version: string };

/** A tool's answer: the bridge's response as JSON, in labelled fields; an error unless done. */
function toolResult(response: AiResponse): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(response) }],
    ...(response.status === "done" ? {} : { isError: true }),
  };
}

/**
 * The MCP server for one connection of `app` (4.9, AIA-4): `AI_TOOLS` as its tools, each call
 * asked of the open site through `ask`, a command on `app`'s behalf. It holds no state of its own,
 * so any transport can carry it: the loopback HTTP one for AI apps (ADR 0021), or an in-memory one
 * for an in-app assistant. Nothing of a call or its answer is logged, the SDK's errors included.
 */
export function createMcpServer(info: McpServerInfo, app: McpApp, ask: AiBridge["ask"]): Server {
  const server = new Server(info, { capabilities: { tools: {} } });
  // The SDK reports a transport's or handler's errors here; they may quote a request.
  server.onerror = () => undefined;
  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: AI_TOOLS.map(({ name, description, inputSchema }) => ({
      name,
      description,
      inputSchema,
    })),
  }));
  server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
    const tool = AI_TOOLS.find((each) => each.name === params.name);
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
