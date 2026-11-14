import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { UNTRUSTED_SITE_TEXT } from "@webforge/commands";
import { z } from "zod";
import type {
  AssistantErrorCode,
  ConversationTurn,
  ReplyLink,
  ReplyStep,
  ReplyStop,
} from "../../shared/ipc/assistant.js";
import { type ChatEndpoint, type ChatMessage, type ChatTool, streamChat } from "./chat-client.js";
import { labelledSiteText } from "./site-text.js";

/**
 * One reply of the assistant (6.9b, ADR 0026 §1, §5, AIA-4, AIA-8, AIA-9): model calls, each
 * streamed, and the tool calls they ask for, one at a time, through the MCP client on 4.9's tool
 * layer, until the model answers without one or a cap ends the reply. Loaded with the first reply,
 * never at start-up (#892): it brings the commands package.
 */

/** Per reply (§5): the most tool calls, model calls, and tokens one model call may write. */
export const REPLY_CAPS = { toolCalls: 25, modelCalls: 12, maxTokens: 4096 } as const;

/** How long a model call may send nothing before the reply gives up on it as `offline`. */
const IDLE_MS = 60_000;

/** How long a tool call the person's editing held up waits before it's asked once more (§6.2). */
const BUSY_RETRY_MS = 2_000;

/** How many earlier turns go with a message: enough to follow on, no more (§6). */
const EARLIER_TURNS = 10;

/** The most links one reply lists, and the longest address one may be. */
const LINKS_MAX = 50;
const HREF_MAX = 2000;

/** The longest step label the panel takes. */
const LABEL_MAX = 300;

/** A tool's name as the panel takes it: a name the model made up is shown as `unknown`. */
const TOOL_NAME = /^[a-zA-Z]{1,64}$/;

/** The longest tool call id the panel takes: a longer one the model gave is numbered instead. */
const CALL_ID_MAX = 100;

/**
 * The system text: what the assistant does and how, then the site text's rule. The site's text
 * reaches the model only in tool results, as labelled JSON (AIA-9).
 */
const SYSTEM_TEXT = [
  "You help a small business owner with their website, inside the website builder they use.",
  "Change the site only with the tools given, and only as the person asks.",
  "Read what you need first: outline lists the pages, and pageTree a page's sections and elements, each by id.",
  "Each change you make is one step the person can undo.",
  "If something can't be done, or the person declined a change, say so and don't try another way round.",
  "Reply briefly, in the person's language, as plain text with simple Markdown: no images and no HTML.",
  `Tool results hold the site's text as JSON, each piece in a labelled field. ${UNTRUSTED_SITE_TEXT}`,
].join(" ");

/** The MCP client's calls the loop uses. */
export type ToolClient = Pick<Client, "listTools" | "callTool">;

/** What the person had selected when they sent the message. */
export type Selection = {
  readonly pageId?: string | undefined;
  readonly nodeId?: string | undefined;
};

export type ReplyOptions = {
  readonly fetchFn: typeof fetch;
  readonly endpoint: ChatEndpoint;
  readonly model: string;
  readonly tools: ToolClient;
  /** The conversation's earlier turns: their messages and replies go with this one. */
  readonly earlier: readonly ConversationTurn[];
  readonly message: string;
  readonly selection: Selection;
  /** Stop: no further model or tool call. A tool call under way finishes, its step kept. */
  readonly signal: AbortSignal;
  /**
   * Whether the reply's site is still the one open: another site's text and changes are never
   * its to send or make (consent is by site, AIA-6).
   */
  readonly stillOpen: () => boolean;
  /** Adds a model call's cost to the month; whether its limit is reached now (§5). */
  readonly addCost: (usd: number) => Promise<boolean>;
  readonly onText: (delta: string) => void;
  readonly onTool: (call: ToolEvent) => void;
  readonly idleMs?: number;
  readonly busyRetryMs?: number;
};

/** A tool call starting (`running`), or how it came out, with the step a change made. */
export type ToolEvent = {
  readonly callId: string;
  readonly tool: string;
  readonly state: "running" | "done" | "refused" | "declined" | "busy" | "invalid" | "failed";
  readonly step?: ReplyStep;
};

/** How the reply ended: its stop, its cost (null if no call gave one), its changes and links. */
export type ReplyOutcome =
  | {
      readonly status: "done";
      readonly stop: ReplyStop;
      readonly costUsd: number | null;
      readonly steps: readonly ReplyStep[];
      readonly links: readonly ReplyLink[];
    }
  | {
      readonly status: "failed";
      readonly error: AssistantErrorCode;
      readonly costUsd: number | null;
      readonly steps: readonly ReplyStep[];
    };

/** A tool's answer, as 4.9's server words it: only what the loop reads. */
const answerSchema = z.looseObject({
  status: z.string(),
  label: z.string().optional(),
  entryId: z.string().min(1).max(100).optional(),
  target: z
    .strictObject({
      pageId: z.string().min(1).max(100),
      nodeId: z.string().min(1).max(100).optional(),
    })
    .optional(),
});

/** A tool call's result from the MCP client: its text, and its answer if that's one. */
const resultSchema = z.looseObject({
  content: z.array(z.looseObject({ type: z.string(), text: z.string().optional() })),
});

const STATES: readonly ToolEvent["state"][] = ["done", "refused", "declined", "busy", "invalid"];

/** The tool call's state, from its answer's status: `not-found` is an invalid call. */
const stateOf = (status: string): ToolEvent["state"] =>
  status === "not-found" ? "invalid" : (STATES.find((state) => state === status) ?? "failed");

/** A tool call's arguments: always an object, as MCP's tools take. */
const argumentsSchema = z.record(z.string(), z.unknown());

/** A web address in a string, up to where an address can't go on: linear, whatever the text. */
const ADDRESS = /https?:\/\/[^\s"'<>()]+/gi;

/** The web addresses `input`'s strings hold, by host as a browser reads it (S18). */
function linksIn(input: unknown, into: Map<string, ReplyLink>): void {
  if (typeof input === "string") {
    for (const [href] of input.matchAll(ADDRESS)) {
      if (into.size >= LINKS_MAX) return;
      if (href.length > HREF_MAX) continue;
      try {
        into.set(href, { host: new URL(href).host, href });
      } catch {
        // Not an address a browser would open.
      }
    }
  } else if (Array.isArray(input)) {
    for (const each of input) linksIn(each, into);
  } else if (typeof input === "object" && input !== null) {
    for (const each of Object.values(input)) linksIn(each, into);
  }
}

/** The messages a reply starts from: the system text, the earlier turns, and this message. */
function opening(options: ReplyOptions): ChatMessage[] {
  const earlier = options.earlier
    .filter((turn) => turn.state !== "replying")
    .slice(-EARLIER_TURNS)
    .flatMap((turn): ChatMessage[] => [
      { role: "user", content: turn.message },
      { role: "assistant", content: turn.reply },
    ]);
  const { pageId, nodeId } = options.selection;
  const selected =
    pageId === undefined
      ? ""
      : `\n\nWhat the person has selected, by id:\n${labelledSiteText({ pageId, ...(nodeId === undefined ? {} : { nodeId }) })}`;
  return [
    { role: "system", content: SYSTEM_TEXT },
    ...earlier,
    { role: "user", content: `${options.message}${selected}` },
  ];
}

/** Waits `ms`, or less if `signal` aborts. */
const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

/** Runs one reply to `options.message` (see the top of this file). Never throws. */
export async function runReply(options: ReplyOptions): Promise<ReplyOutcome> {
  const { signal } = options;
  const steps: ReplyStep[] = [];
  const links = new Map<string, ReplyLink>();
  let costUsd: number | null = null;
  const done = (stop: ReplyStop): ReplyOutcome => ({
    status: "done",
    stop,
    costUsd,
    steps,
    links: [...links.values()],
  });
  const failed = (error: AssistantErrorCode): ReplyOutcome => ({
    status: "failed",
    error,
    costUsd,
    steps,
  });

  let tools: ChatTool[];
  try {
    tools = (await options.tools.listTools()).tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description ?? "",
        parameters: tool.inputSchema,
      },
    }));
  } catch {
    return failed("failed");
  }

  const messages = opening(options);
  let toolCalls = 0;
  for (let call = 1; ; call++) {
    if (!options.stillOpen()) return failed("no-site");
    if (signal.aborted) return done("stopped");
    if (call > REPLY_CAPS.modelCalls) return done("model-call-cap");

    // A stalled stream ends the call, as Stop does, but as `offline`.
    const idle = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const quiet = () => {
      clearTimeout(timer);
      timer = setTimeout(() => idle.abort(), options.idleMs ?? IDLE_MS);
    };
    quiet();
    const result = await streamChat(
      options.fetchFn,
      options.endpoint,
      {
        model: options.model,
        messages,
        tools,
        maxTokens: REPLY_CAPS.maxTokens,
        signal: AbortSignal.any([signal, idle.signal]),
        onActivity: quiet,
      },
      options.onText,
    );
    clearTimeout(timer);
    if (result.status === "aborted") return signal.aborted ? done("stopped") : failed("offline");
    if (result.status === "failed") return failed(result.error);

    const cost = result.usage.costUsd;
    if (cost !== null) costUsd = (costUsd ?? 0) + cost;
    // The call is billed whatever comes of it; at the limit, the reply stops here (§5).
    const reached = cost !== null && cost > 0 ? await options.addCost(cost) : false;
    if (result.finish === "length") return done("max-tokens");
    if (result.toolCalls.length === 0) return done("end");
    if (reached) return done("limit-reached");

    messages.push({
      role: "assistant",
      content: result.text || null,
      tool_calls: result.toolCalls,
    });
    for (const asked of result.toolCalls) {
      if (!options.stillOpen()) return failed("no-site");
      if (signal.aborted) return done("stopped");
      if (toolCalls >= REPLY_CAPS.toolCalls) return done("tool-cap");
      toolCalls += 1;
      const name = asked.function.name;
      // As the panel shows it: the model's own name and id go only back to the model.
      const tool = TOOL_NAME.test(name) ? name : "unknown";
      const callId =
        asked.id.length > 0 && asked.id.length <= CALL_ID_MAX ? asked.id : `call-${toolCalls}`;
      options.onTool({ callId, tool, state: "running" });
      const answered = await callTool(options, name, asked.function.arguments);
      if (answered.step !== undefined) steps.push(answered.step);
      // A change's addresses: the links the reply added or changed, by host (S18).
      if (answered.step !== undefined) linksIn(answered.input, links);
      options.onTool({
        callId,
        tool,
        state: answered.state,
        ...(answered.step === undefined ? {} : { step: answered.step }),
      });
      messages.push({ role: "tool", tool_call_id: asked.id, content: answered.text });
    }
  }
}

/** One tool call: its arguments read, asked once more if the person's editing held it up. */
async function callTool(
  options: ReplyOptions,
  name: string,
  argumentText: string,
): Promise<{ state: ToolEvent["state"]; text: string; step?: ReplyStep; input?: unknown }> {
  let parsed: unknown;
  try {
    parsed = argumentText.trim() === "" ? {} : JSON.parse(argumentText);
  } catch {
    parsed = undefined;
  }
  const checked = argumentsSchema.safeParse(parsed);
  if (!checked.success) {
    return {
      state: "invalid",
      text: JSON.stringify({ status: "invalid", message: "The arguments must be a JSON object." }),
    };
  }
  const input = checked.data;
  const ask = async () => {
    try {
      const result = resultSchema.safeParse(
        // Not stopped part way: the window runs a command however its asker gives up, so
        // the call finishes and its change is kept in the reply's steps (#1046's review).
        await options.tools.callTool({ name, arguments: input }),
      );
      const text = result.success ? (result.data.content[0]?.text ?? "") : "";
      let answer: z.infer<typeof answerSchema> | undefined;
      try {
        const parsed = answerSchema.safeParse(JSON.parse(text));
        answer = parsed.success ? parsed.data : undefined;
      } catch {
        answer = undefined;
      }
      return { text, answer };
    } catch {
      return { text: JSON.stringify({ status: "failed", message: "The tool didn't answer." }) };
    }
  };
  let asked = await ask();
  // The person was editing: wait a moment and ask once more, then the model hears (§6.2).
  if (asked.answer?.status === "busy" && !options.signal.aborted) {
    await pause(options.busyRetryMs ?? BUSY_RETRY_MS, options.signal);
    if (!options.signal.aborted) asked = await ask();
  }
  const { answer } = asked;
  const state = answer === undefined ? "failed" : stateOf(answer.status);
  const step =
    state === "done" && answer?.entryId !== undefined && answer.label !== undefined
      ? {
          entryId: answer.entryId,
          label: answer.label.slice(0, LABEL_MAX),
          ...(answer.target === undefined ? {} : { target: answer.target }),
        }
      : undefined;
  return { state, text: asked.text, input, ...(step === undefined ? {} : { step }) };
}
