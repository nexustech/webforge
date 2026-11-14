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
  UNTRUSTED_SITE_TEXT,
} from "@webforge/commands";
import { t } from "@webforge/i18n";
import {
  type AiRequest,
  type AiResponse,
  APP_TOOLS,
  ASSISTANT_APP_ID,
  REQUEST_MEDIA,
} from "../shared/ipc/ai.js";
import { buildSitePrompt, buildSitePromptInfo } from "./mcp-prompts.js";
import { MAIN_TOOLS } from "./site-brief.js";

/** An AI app the person paired (4.9): its id, and the name they gave it, never its own. */
export type McpApp = { readonly id: string; readonly name: string };

/** What the server says it is to an AI app: Webforge, by the name the build has, and its version. */
export type McpServerInfo = { readonly name: string; readonly version: string };

/**
 * Every tool an AI app sees: the command layer's (`AI_TOOLS`), then those the window answers
 * itself (`APP_TOOLS`, each a query taking nothing, and `requestMedia`, which asks the person).
 */
const TOOLS = [
  ...AI_TOOLS,
  ...Object.entries(APP_TOOLS).map(([name, description]) => ({
    kind: "query" as const,
    name,
    description: `${description} ${UNTRUSTED_SITE_TEXT}`,
    inputSchema: { type: "object" as const, properties: {}, additionalProperties: false },
  })),
  {
    kind: "command" as const,
    name: REQUEST_MEDIA.name,
    description: `${REQUEST_MEDIA.description} ${UNTRUSTED_SITE_TEXT}`,
    inputSchema: {
      type: "object" as const,
      properties: { reason: { type: "string", minLength: 1, maxLength: 200 } },
      required: ["reason"],
      additionalProperties: false,
    },
  },
  // Main's own (4.12a): a new site from a brief, and what it chooses from.
  ...Object.entries(MAIN_TOOLS).map(([name, tool]) => ({
    kind: tool.kind,
    name,
    description: `${tool.description} ${UNTRUSTED_SITE_TEXT}`,
    inputSchema: tool.inputSchema,
  })),
];

/**
 * How often a call that waits (a brief the person is checking, a change waiting for Allow) reports
 * progress, when the app asked for it: a client may take each report to put off its timeout.
 */
const PROGRESS_EVERY_MS = 10_000;

/** The catalogue resource's content (AIB-1): the same for every connection, made once. */
let catalogueText: string | undefined;

/**
 * The assistant's tools (AIA-9): the command layer's, and Site Check. Not Preview, which opens the
 * browser, nor Media requests, which ask for files, nor main's site briefs, which start a new site.
 */
const ASSISTANT_TOOL_NAMES = new Set([...AI_TOOLS.map((tool) => tool.name), "runSiteCheck"]);
const ASSISTANT_TOOLS = TOOLS.filter((tool) => ASSISTANT_TOOL_NAMES.has(tool.name));

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
  ask: (request: AiRequest, signal?: AbortSignal) => Promise<AiResponse>,
  progressEveryMs = PROGRESS_EVERY_MS,
): Server {
  return serve(info, app, ask, TOOLS, false, progressEveryMs);
}

/**
 * The MCP server for the in-app assistant (6.9b, ADR 0026 §1), over the SDK's in-memory transport:
 * as an AI app's, with {@link ASSISTANT_TOOLS}, on behalf of {@link assistantApp}, and telling it
 * each command's undo step and what it changed.
 */
export function createAssistantMcpServer(
  info: McpServerInfo,
  ask: (request: AiRequest, signal?: AbortSignal) => Promise<AiResponse>,
  stage?: string,
): Server {
  return serve(info, assistantApp(), ask, ASSISTANT_TOOLS, true, PROGRESS_EVERY_MS, stage);
}

/** A server for `app` with `tools`, its commands' undo steps told to it when `steps`. */
function serve(
  info: McpServerInfo,
  app: McpApp,
  ask: (request: AiRequest, signal?: AbortSignal) => Promise<AiResponse>,
  tools: readonly (typeof TOOLS)[number][],
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
    tools: tools.map(({ name, description, inputSchema }) => ({
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
