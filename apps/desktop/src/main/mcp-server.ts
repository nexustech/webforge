import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  type CallToolResult,
  ErrorCode,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  AI_TOOLS,
  CATALOGUE_RESOURCE,
  catalogueResourceText,
  type McpTool,
  type ToolDef,
  toMcpTool,
} from "@webforge/commands";
import { t } from "@webforge/i18n";
import { MAIN_TOOLS, WINDOW_TOOLS } from "../shared/ai-tools.js";
import { type AiRequest, type AiResponse, ASSISTANT_APP_ID } from "../shared/ipc/ai.js";
import { buildSitePrompt, buildSitePromptInfo } from "./mcp-prompts.js";

/** An AI app the person paired (4.9): its id, and the name they gave it, never its own. */
export type McpApp = { readonly id: string; readonly name: string };

/** What the server says it is to an AI app: Webforge, by the name the build has, and its version. */
export type McpServerInfo = { readonly name: string; readonly version: string };

/**
 * Every tool an AI app sees, each one definition (#981): the command layer's (`AI_TOOLS`), then
 * those the window answers itself, then main's own (4.12a): a new site from a brief, and what it
 * chooses from.
 */
const TOOLS: readonly ToolDef[] = [...AI_TOOLS, ...WINDOW_TOOLS, ...MAIN_TOOLS];

/** Each tool as `tools/list` gives it, made once: its input's JSON Schema comes from its zod. */
const LISTED = new Map<ToolDef, McpTool>(TOOLS.map((tool) => [tool, toMcpTool(tool)]));

/**
 * What main's `ask` is told of the tool a call is for (#981): who answers it, and whether a version
 * is saved before it. The server has the definitions; main's service never loads them.
 */
type ToolRoute = Pick<ToolDef, "answeredBy" | "savesVersionFirst">;

/** A call to the open site or to main, for the tool `tool`, until `signal` gives up on it. */
export type McpAsk = (
  request: AiRequest,
  tool: ToolRoute,
  signal?: AbortSignal,
) => Promise<AiResponse>;

/**
 * How often a call that waits (a brief the person is checking, a change waiting for Allow) reports
 * progress, when the app asked for it: a client may take each report to put off its timeout.
 */
const PROGRESS_EVERY_MS = 10_000;

/** The catalogue resource's content (AIB-1): the same for every connection, made once. */
let catalogueText: string | undefined;

/**
 * The assistant's tools (AIA-9): those whose definition says so. The command layer's and Site
 * Check; not Preview, which opens the browser, nor Media requests, which ask for files, nor main's
 * site briefs, which start a new site.
 */
const ASSISTANT_TOOLS = TOOLS.filter((tool) => tool.forAssistant);

/** Who the in-app assistant is to the tool layer: its steps are "AI (Assistant): …" (ADR 0026 §1). */
export const assistantApp = (): McpApp => ({ id: ASSISTANT_APP_ID, name: t("assistant.name") });

/**
 * A tool's answer: the bridge's response as JSON, in labelled fields; an error unless done, or a
 * brief still waiting for the person. A command's undo step and what it changed go only to the
 * assistant (`steps`), which shows them (6.9b): an AI app is told what it made, as before.
 */
function toolResult(response: AiResponse, steps: boolean): CallToolResult {
  const shown =
    steps || response.status !== "done" || !("label" in response)
      ? response
      : {
          status: response.status,
          label: response.label,
          ...(response.id === undefined ? {} : { id: response.id }),
        };
  return {
    content: [{ type: "text", text: JSON.stringify(shown) }],
    ...(response.status === "done" || response.status === "waiting" ? {} : { isError: true }),
  };
}

/**
 * The MCP server for one connection of `app` (4.9, AIA-4): {@link TOOLS} as its tools, each call
 * asked of the open site through `ask`, a command on `app`'s behalf; the catalogue as its one
 * resource (AIB-1), which is Webforge's, not the site's, so needs no site open; and *Build a site
 * from a description* as its one prompt (AIB-8). It holds no state of its own,
 * so any transport can carry it: the loopback HTTP one for AI apps (ADR 0021), or an in-memory one
 * for an in-app assistant. Nothing of a call or its answer is logged, the SDK's errors included.
 */
export function createMcpServer(
  info: McpServerInfo,
  app: McpApp,
  ask: McpAsk,
  progressEveryMs = PROGRESS_EVERY_MS,
): Server {
  return serve(info, app, ask, TOOLS, false, progressEveryMs);
}

/**
 * The MCP server for the in-app assistant (6.9b, ADR 0026 §1), over the SDK's in-memory transport:
 * as an AI app's, with {@link ASSISTANT_TOOLS}, on behalf of {@link assistantApp}, and telling it
 * each command's undo step and what it changed.
 */
export function createAssistantMcpServer(info: McpServerInfo, ask: McpAsk, stage?: string): Server {
  return serve(info, assistantApp(), ask, ASSISTANT_TOOLS, true, PROGRESS_EVERY_MS, stage);
}

/** A server for `app` with `tools`, its commands' undo steps told to it when `steps`. */
function serve(
  info: McpServerInfo,
  app: McpApp,
  ask: McpAsk,
  tools: readonly ToolDef[],
  steps: boolean,
  progressEveryMs: number,
  /** The reply whose changes are held (6.9e): each request goes to its draft of the site. */
  stage?: string,
): Server {
  const held = stage === undefined ? {} : { stage };
  const server = new Server(info, { capabilities: { tools: {}, resources: {}, prompts: {} } });
  // The SDK reports a transport's or handler's errors here; they may quote a request.
  server.onerror = () => undefined;
  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: tools.map((tool) => LISTED.get(tool) ?? toMcpTool(tool)),
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
  // The one prompt (4.12b, AIB-8): the order that builds a site, in the app's prompt menu.
  server.setRequestHandler(ListPromptsRequestSchema, () => ({ prompts: [buildSitePromptInfo()] }));
  server.setRequestHandler(GetPromptRequestSchema, ({ params }) => {
    if (params.name !== buildSitePromptInfo().name) {
      throw new McpError(ErrorCode.InvalidParams, "There is no such prompt.");
    }
    return buildSitePrompt(params.arguments?.description);
  });
  server.setRequestHandler(CallToolRequestSchema, async ({ params }, extra) => {
    const tool = tools.find((each) => each.name === params.name);
    if (tool === undefined) {
      return toolResult({ status: "invalid", message: "There is no such tool." }, steps);
    }
    const input = params.arguments ?? {};
    // While it waits for the person, it says it's still going, if the app asked to be told (4.12a).
    const progressToken = params._meta?.progressToken;
    let progress = 0;
    const still =
      progressToken === undefined
        ? undefined
        : setInterval(() => {
            progress += 1;
            void extra
              .sendNotification({
                method: "notifications/progress",
                params: { progressToken, progress },
              })
              .catch(() => undefined);
          }, progressEveryMs);
    try {
      return toolResult(
        await ask(
          tool.kind === "query"
            ? { kind: "query", name: tool.name, input, ...held }
            : { kind: "command", name: tool.name, input, app: app.name, ...held },
          tool,
          // The app giving up on the request: a brief stops waiting for the person.
          extra.signal,
        ),
        steps,
      );
    } finally {
      clearInterval(still);
    }
  });
  return server;
}
