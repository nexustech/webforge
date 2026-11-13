import { z } from "zod";
import type { AssistantErrorCode } from "../../shared/ipc/assistant.js";

/**
 * The assistant's one model client (6.9a, ADR 0026 §1–§2): OpenAI-compatible Chat Completions,
 * streamed over SSE, for OpenRouter, a local server (Ollama, LM Studio) or any server the person
 * names. No AI SDK: a `fetch` (Electron's `net.fetch` in the app, for the system's proxy) whose
 * every chunk zod checks. Nothing here logs or keeps what it sends or receives.
 */

/** A message of the conversation, as Chat Completions takes it. */
type ChatMessage =
  | { readonly role: "system" | "user"; readonly content: string }
  | {
      readonly role: "assistant";
      readonly content: string | null;
      readonly tool_calls?: readonly ChatToolCall[];
    }
  | { readonly role: "tool"; readonly tool_call_id: string; readonly content: string };

/** A tool the model may call: an MCP tool's name, description and JSON Schema, one to one. */
type ChatTool = {
  readonly type: "function";
  readonly function: {
    readonly name: string;
    readonly description: string;
    readonly parameters: Readonly<Record<string, unknown>>;
  };
};

/** A tool call the model proposed, put together from its streamed pieces. */
type ChatToolCall = {
  readonly id: string;
  readonly type: "function";
  readonly function: { readonly name: string; readonly arguments: string };
};

/** Where requests go, and how. */
export type ChatEndpoint = {
  /** Up to `/v1` (or OpenRouter's `/api/v1`), without a trailing slash. */
  readonly baseUrl: string;
  /** Sent as `Authorization: Bearer`; none for a local server. */
  readonly key?: string | undefined;
  /** OpenRouter: its privacy fields and its title header (ADR 0026 §2). */
  readonly openRouter?:
    | {
        /** The app's name, for OpenRouter's `X-OpenRouter-Title`. It carries no content. */
        readonly title: string;
        /** Advanced's *Allow models that may keep requests*: drops `zdr` and `data_collection`. */
        readonly allowRetaining: boolean;
      }
    | undefined;
};

export type ChatRequest = {
  readonly model: string;
  readonly messages: readonly ChatMessage[];
  readonly tools?: readonly ChatTool[];
  /** Per model call (ADR 0026 §5). */
  readonly maxTokens: number;
  readonly signal?: AbortSignal;
};

/** How the model call ended. */
export type ChatResult =
  | {
      readonly status: "done";
      readonly text: string;
      readonly toolCalls: readonly ChatToolCall[];
      /** `stop`, `tool_calls`, `length` (the `max_tokens` ran out), or another the server gives. */
      readonly finish: string;
      readonly usage: {
        readonly promptTokens: number;
        readonly completionTokens: number;
        /** OpenRouter's `usage.cost`, in US dollars; null where the server gives none. */
        readonly costUsd: number | null;
      };
    }
  | { readonly status: "aborted"; readonly text: string }
  | { readonly status: "failed"; readonly error: AssistantErrorCode; readonly httpStatus?: number };

/** The most text one reply's streamed chunks may add up to, a guard against a runaway server. */
const TEXT_MAX_CHARS = 200_000;

/** One streamed chunk: only what the client reads, and anything else a server adds let through. */
const chunkSchema = z.looseObject({
  choices: z
    .array(
      z.looseObject({
        delta: z
          .looseObject({
            content: z.string().nullish(),
            tool_calls: z
              .array(
                z.looseObject({
                  index: z.int().nonnegative().max(100),
                  id: z.string().max(200).nullish(),
                  function: z
                    .looseObject({
                      name: z.string().max(200).nullish(),
                      arguments: z.string().nullish(),
                    })
                    .nullish(),
                }),
              )
              .nullish(),
          })
          .nullish(),
        finish_reason: z.string().max(50).nullish(),
      }),
    )
    .nullish(),
  usage: z
    .looseObject({
      prompt_tokens: z.number().nonnegative().nullish(),
      completion_tokens: z.number().nonnegative().nullish(),
      cost: z.number().nonnegative().nullish(),
    })
    .nullish(),
  /** A failure part way through the stream, as OpenRouter sends one. */
  error: z.looseObject({ code: z.union([z.number(), z.string()]).nullish() }).nullish(),
});

/** What an HTTP status means for the person (ADR 0026 §7's codes). */
function errorForStatus(status: number): AssistantErrorCode {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 402) return "no-credit";
  if (status === 429) return "rate-limited";
  if (status === 404) return "model-unavailable";
  return "provider-error";
}

/** The request's headers: the key, and for OpenRouter its title. */
function headersFor(endpoint: ChatEndpoint): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "text/event-stream",
  };
  if (endpoint.key !== undefined) headers.authorization = `Bearer ${endpoint.key}`;
  if (endpoint.openRouter !== undefined) headers["x-openrouter-title"] = endpoint.openRouter.title;
  return headers;
}

/** The request's body: OpenRouter's privacy fields and cost unless Advanced allows otherwise. */
export function bodyFor(endpoint: ChatEndpoint, request: ChatRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: request.model,
    messages: request.messages,
    stream: true,
    max_tokens: request.maxTokens,
    stream_options: { include_usage: true },
  };
  if (request.tools !== undefined && request.tools.length > 0) body.tools = request.tools;
  if (endpoint.openRouter !== undefined) {
    body.usage = { include: true };
    if (!endpoint.openRouter.allowRetaining) {
      body.provider = { zdr: true, data_collection: "deny" };
    }
  }
  return body;
}

/** The `data:` payloads of an SSE stream, as they arrive; comments and other fields skipped. */
async function* sseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffered = "";
  for await (const bytes of body) {
    buffered += decoder.decode(bytes, { stream: true });
    for (let end = buffered.indexOf("\n"); end !== -1; end = buffered.indexOf("\n")) {
      const line = buffered.slice(0, end).replace(/\r$/, "");
      buffered = buffered.slice(end + 1);
      if (line.startsWith("data:")) yield line.slice(5).trimStart();
    }
  }
  const last = (buffered + decoder.decode()).replace(/\r$/, "");
  if (last.startsWith("data:")) yield last.slice(5).trimStart();
}

/**
 * Sends one model call and streams its text to `onText` as it comes; puts the tool calls together
 * from their pieces. Never throws: a failure is a result, with §7's code.
 */
export async function streamChat(
  fetchFn: typeof fetch,
  endpoint: ChatEndpoint,
  request: ChatRequest,
  onText: (delta: string) => void,
): Promise<ChatResult> {
  let text = "";
  const aborted = () => request.signal?.aborted === true;
  let response: Response;
  try {
    response = await fetchFn(`${endpoint.baseUrl}/chat/completions`, {
      method: "POST",
      headers: headersFor(endpoint),
      body: JSON.stringify(bodyFor(endpoint, request)),
      signal: request.signal ?? null,
    });
  } catch {
    return aborted() ? { status: "aborted", text } : { status: "failed", error: "offline" };
  }
  if (!response.ok || response.body === null) {
    await response.body?.cancel().catch(() => undefined);
    return {
      status: "failed",
      error: errorForStatus(response.status),
      httpStatus: response.status,
    };
  }

  const calls = new Map<number, { id: string; name: string; arguments: string }>();
  let finish = "stop";
  let usage: Extract<ChatResult, { status: "done" }>["usage"] = {
    promptTokens: 0,
    completionTokens: 0,
    costUsd: null,
  };
  try {
    for await (const data of sseData(response.body)) {
      // Stop: read nothing more, even from a server that goes on sending. Leaving the loop
      // cancels the stream.
      if (aborted()) return { status: "aborted", text };
      if (data === "[DONE]") break;
      let json: unknown;
      try {
        json = JSON.parse(data);
      } catch {
        return { status: "failed", error: "provider-error" };
      }
      const chunk = chunkSchema.safeParse(json);
      if (!chunk.success) return { status: "failed", error: "provider-error" };
      const { choices, usage: used, error } = chunk.data;
      if (error !== undefined && error !== null) {
        const code = typeof error.code === "number" ? errorForStatus(error.code) : "provider-error";
        return { status: "failed", error: code };
      }
      for (const choice of choices ?? []) {
        const delta = choice.delta;
        if (typeof delta?.content === "string" && delta.content !== "") {
          if (text.length + delta.content.length > TEXT_MAX_CHARS) {
            return { status: "failed", error: "provider-error" };
          }
          text += delta.content;
          onText(delta.content);
        }
        for (const piece of delta?.tool_calls ?? []) {
          const call = calls.get(piece.index) ?? { id: "", name: "", arguments: "" };
          if (typeof piece.id === "string" && piece.id !== "") call.id = piece.id;
          call.name += piece.function?.name ?? "";
          call.arguments += piece.function?.arguments ?? "";
          if (call.arguments.length > TEXT_MAX_CHARS) {
            return { status: "failed", error: "provider-error" };
          }
          calls.set(piece.index, call);
        }
        if (typeof choice.finish_reason === "string") finish = choice.finish_reason;
      }
      if (used !== undefined && used !== null) {
        usage = {
          promptTokens: used.prompt_tokens ?? 0,
          completionTokens: used.completion_tokens ?? 0,
          costUsd: used.cost ?? null,
        };
      }
    }
  } catch {
    return aborted() ? { status: "aborted", text } : { status: "failed", error: "offline" };
  }
  if (aborted()) return { status: "aborted", text };

  const toolCalls: ChatToolCall[] = [...calls.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, call]) => ({
      // A server that gives no id (some local ones) gets one, so its result can name it.
      id: call.id === "" ? `call-${index}` : call.id,
      type: "function",
      function: { name: call.name, arguments: call.arguments === "" ? "{}" : call.arguments },
    }));
  if (toolCalls.some((call) => call.function.name === "")) {
    return { status: "failed", error: "provider-error" };
  }
  return { status: "done", text, toolCalls, finish, usage };
}
