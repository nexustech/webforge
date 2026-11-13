import { describe, expect, it, vi } from "vitest";
import { bodyFor, type ChatEndpoint, type ChatRequest, streamChat } from "./chat-client.js";

const OPENROUTER: ChatEndpoint = {
  baseUrl: "https://openrouter.ai/api/v1",
  key: "sk-or-v1-test",
  openRouter: { title: "Webforge", allowRetaining: false },
};
const OLLAMA: ChatEndpoint = { baseUrl: "http://localhost:11434/v1" };
const REQUEST: ChatRequest = {
  model: "example/model-medium",
  messages: [{ role: "user", content: "Say we open on Saturdays" }],
  maxTokens: 4096,
};

/** A provider's answer: SSE events, sent in `pieces` so lines and events arrive split. */
function sse(events: readonly unknown[], { pieces = 3 }: { pieces?: number } = {}) {
  const text = events
    .map((event) =>
      event === "[DONE]" ? "data: [DONE]\n\n" : `data: ${JSON.stringify(event)}\n\n`,
    )
    .join("");
  const bytes = new TextEncoder().encode(`: OPENROUTER PROCESSING\n\n${text}`);
  const size = Math.ceil(bytes.length / pieces);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let at = 0; at < bytes.length; at += size)
        controller.enqueue(bytes.slice(at, at + size));
      controller.close();
    },
  });
}

/** A fake provider: answers each request with `response`, and keeps what it was sent. */
function provider(response: () => Response) {
  const requests: { url: string; init: RequestInit }[] = [];
  const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), init: init ?? {} });
    return response();
  }) as unknown as typeof fetch;
  return { fetchFn, requests };
}

const delta = (content: string) => ({ choices: [{ delta: { content } }] });

describe("the assistant's model client (6.9a, ADR 0026 §1–§2)", () => {
  it("streams a reply's text as it comes, with its usage and OpenRouter's cost", async () => {
    const { fetchFn, requests } = provider(
      () =>
        new Response(
          sse([
            delta("We now "),
            delta("open on "),
            delta("Saturdays."),
            { choices: [{ delta: {}, finish_reason: "stop" }] },
            { choices: [], usage: { prompt_tokens: 1200, completion_tokens: 30, cost: 0.0042 } },
            "[DONE]",
          ]),
        ),
    );
    const deltas: string[] = [];

    const result = await streamChat(fetchFn, OPENROUTER, REQUEST, (text) => deltas.push(text));

    expect(deltas).toEqual(["We now ", "open on ", "Saturdays."]);
    expect(result).toEqual({
      status: "done",
      text: "We now open on Saturdays.",
      toolCalls: [],
      finish: "stop",
      usage: { promptTokens: 1200, completionTokens: 30, costUsd: 0.0042 },
    });
    const [sent] = requests;
    expect(sent?.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(sent?.init.headers).toMatchObject({
      authorization: "Bearer sk-or-v1-test",
      "x-openrouter-title": "Webforge",
    });
  });

  it("asks OpenRouter for endpoints that keep nothing and don't train, unless Advanced allows", () => {
    expect(bodyFor(OPENROUTER, REQUEST)).toMatchObject({
      provider: { zdr: true, data_collection: "deny" },
      usage: { include: true },
      stream: true,
      max_tokens: 4096,
    });
    const allowing = { ...OPENROUTER, openRouter: { title: "Webforge", allowRetaining: true } };
    expect(bodyFor(allowing, REQUEST)).not.toHaveProperty("provider");
    // A local server gets neither, nor OpenRouter's headers or a key.
    expect(bodyFor(OLLAMA, REQUEST)).not.toHaveProperty("provider");
    expect(bodyFor(OLLAMA, REQUEST)).not.toHaveProperty("usage");
  });

  it("puts tool calls together from their pieces, in order", async () => {
    const { fetchFn, requests } = provider(
      () =>
        new Response(
          sse(
            [
              {
                choices: [
                  {
                    delta: {
                      tool_calls: [
                        { index: 0, id: "call_a", function: { name: "outline", arguments: "" } },
                      ],
                    },
                  },
                ],
              },
              {
                choices: [
                  {
                    delta: { tool_calls: [{ index: 1, id: "call_b", function: { name: "upd" } }] },
                  },
                ],
              },
              {
                choices: [
                  { delta: { tool_calls: [{ index: 1, function: { name: "ateFields" } }] } },
                ],
              },
              {
                choices: [
                  { delta: { tool_calls: [{ index: 1, function: { arguments: '{"nodeId":' } }] } },
                ],
              },
              {
                choices: [
                  {
                    delta: { tool_calls: [{ index: 1, function: { arguments: '"hero"}' } }] },
                    finish_reason: "tool_calls",
                  },
                ],
              },
              "[DONE]",
            ],
            { pieces: 7 },
          ),
        ),
    );

    const result = await streamChat(
      fetchFn,
      OLLAMA,
      {
        ...REQUEST,
        tools: [
          { type: "function", function: { name: "outline", description: "", parameters: {} } },
        ],
      },
      () => undefined,
    );

    expect(result).toMatchObject({
      status: "done",
      finish: "tool_calls",
      toolCalls: [
        { id: "call_a", type: "function", function: { name: "outline", arguments: "{}" } },
        { id: "call_b", function: { name: "updateFields", arguments: '{"nodeId":"hero"}' } },
      ],
      usage: { costUsd: null },
    });
    expect(requests[0]?.init.headers).not.toHaveProperty("authorization");
  });

  it("says what a refusal means for the person, by its HTTP status", async () => {
    for (const [status, error] of [
      [401, "unauthorized"],
      [402, "no-credit"],
      [404, "model-unavailable"],
      [429, "rate-limited"],
      [500, "provider-error"],
    ] as const) {
      const { fetchFn } = provider(
        () =>
          new Response(JSON.stringify({ error: { message: "quoting the request…" } }), { status }),
      );
      expect(await streamChat(fetchFn, OPENROUTER, REQUEST, () => undefined)).toEqual({
        status: "failed",
        error,
        httpStatus: status,
      });
    }
  });

  it("says offline when nothing answers, and provider-error for a stream it can't read", async () => {
    const offline = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    expect(await streamChat(offline, OPENROUTER, REQUEST, () => undefined)).toEqual({
      status: "failed",
      error: "offline",
    });

    const garbled = provider(() => new Response(sse(["not json", "[DONE]"])));
    expect(await streamChat(garbled.fetchFn, OPENROUTER, REQUEST, () => undefined)).toMatchObject({
      error: "provider-error",
    });
    const midStream = provider(
      () => new Response(sse([delta("Half"), { error: { code: 402, message: "no credit" } }])),
    );
    expect(await streamChat(midStream.fetchFn, OPENROUTER, REQUEST, () => undefined)).toEqual({
      status: "failed",
      error: "no-credit",
    });
    const nameless = provider(
      () =>
        new Response(
          sse([{ choices: [{ delta: { tool_calls: [{ index: 0, id: "x" }] } }] }, "[DONE]"]),
        ),
    );
    expect(await streamChat(nameless.fetchFn, OPENROUTER, REQUEST, () => undefined)).toMatchObject({
      error: "provider-error",
    });
  });

  it("stops at Stop: the text so far, and nothing more read", async () => {
    const controller = new AbortController();
    let pulled = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(stream) {
        pulled += 1;
        stream.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(delta("word "))}\n\n`));
        if (pulled === 3) controller.abort();
      },
    });
    const { fetchFn } = provider(() => new Response(endless));

    const result = await streamChat(
      fetchFn,
      OPENROUTER,
      { ...REQUEST, signal: controller.signal },
      () => undefined,
    );

    expect(result.status).toBe("aborted");
    expect(pulled).toBeLessThan(10);
  });
});
