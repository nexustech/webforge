import { describe, expect, it, vi } from "vitest";
import {
  applyHeld,
  REPLY_CAPS,
  type ReplyOptions,
  runReply,
  type ToolClient,
  type ToolEvent,
} from "./assistant-loop.js";

/** One model call as the fake model answers it: text, tool calls, how it ends, what it cost. */
type Call = {
  readonly text?: string;
  readonly tools?: readonly { readonly name: string; readonly args: unknown }[];
  readonly finish?: string;
  readonly cost?: number;
  /** Never answers: a stalled stream. */
  readonly stall?: boolean;
};

/** A streamed answer to one call, as OpenRouter sends it; aborting `signal` ends it, as fetch's. */
function stream(call: Call, n: number, signal: AbortSignal | undefined): Response {
  const events: unknown[] = [];
  if (call.text !== undefined) events.push({ choices: [{ delta: { content: call.text } }] });
  (call.tools ?? []).forEach((tool, index) => {
    events.push({
      choices: [
        {
          delta: {
            tool_calls: [
              {
                index,
                id: `call-${n}-${index}`,
                function: { name: tool.name, arguments: JSON.stringify(tool.args) },
              },
            ],
          },
        },
      ],
    });
  });
  const finish = call.finish ?? (call.tools === undefined ? "stop" : "tool_calls");
  events.push({ choices: [{ delta: {}, finish_reason: finish }] });
  events.push({ usage: { prompt_tokens: 10, completion_tokens: 5, cost: call.cost ?? 0.001 } });
  const text = `${events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")}data: [DONE]\n\n`;
  if (call.stall === true) {
    return new Response(
      new ReadableStream({
        start: (controller) =>
          signal?.addEventListener("abort", () => controller.error(signal.reason), { once: true }),
      }),
    );
  }
  return new Response(text);
}

/** A model answering `calls` in turn, and the requests it was sent. */
function model(calls: readonly Call[]) {
  const bodies: { messages: { role: string; content: string | null }[] }[] = [];
  let n = 0;
  const fetchFn = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    const call = calls[n] ?? { text: "Done." };
    n += 1;
    return stream(call, n, init?.signal ?? undefined);
  }) as unknown as typeof fetch;
  return { fetchFn, bodies, calls: () => n };
}

/** The tool layer: its answers by tool name, each a function of the arguments. */
function toolLayer(answers: Record<string, (args: Record<string, unknown>) => unknown>) {
  const called: { name: string; args: unknown }[] = [];
  const client: ToolClient = {
    listTools: vi.fn(async () => ({
      tools: Object.keys(answers).map((name) => ({
        name,
        description: `${name}'s description`,
        inputSchema: { type: "object" as const },
      })),
    })),
    callTool: vi.fn(async ({ name, arguments: args }, _schema, requestOptions) => {
      called.push({ name, args });
      const answer = answers[name]?.(args ?? {}) ?? { status: "invalid", message: "No tool" };
      // As the SDK's client does: its caller giving up rejects the call, whatever the server did.
      if (requestOptions?.signal?.aborted === true) throw new Error("Request aborted");
      return { content: [{ type: "text", text: JSON.stringify(answer) }] };
    }) as unknown as ToolClient["callTool"],
  };
  return { client, called };
}

let entry = 0;
/** A command's answer, as the tool layer gives it to the assistant: a step of its own. */
const changed = (label: string, pageId = "home") => {
  entry += 1;
  return {
    status: "done",
    label: `AI (Assistant): ${label}`,
    entryId: `h${entry}`,
    target: { pageId },
  };
};

/** Runs a reply against `calls` and `answers`, collecting its text, tool events and costs. */
async function reply(
  calls: readonly Call[],
  answers: Record<string, (args: Record<string, unknown>) => unknown>,
  more: Partial<ReplyOptions> = {},
) {
  const { fetchFn, bodies } = model(calls);
  const { client, called } = toolLayer(answers);
  const tools: ToolEvent[] = [];
  const costs: number[] = [];
  let text = "";
  const outcome = await runReply({
    fetchFn,
    endpoint: { baseUrl: "https://openrouter.ai/api/v1", key: "sk-or-v1-test" },
    model: "anthropic/claude-model",
    tools: client,
    earlier: [],
    message: "Make the hero say Fresh bread",
    selection: { pageId: "home", nodeId: "hero" },
    signal: new AbortController().signal,
    addCost: async (usd) => {
      costs.push(usd);
      return false;
    },
    onText: (delta) => {
      text += delta;
    },
    onTool: (event) => tools.push(event),
    stillOpen: () => true,
    busyRetryMs: 1,
    ...more,
  });
  return { outcome, text, tools, costs, called, bodies };
}

describe("the assistant's loop (6.9b, ADR 0026 §1, §5)", () => {
  it("reads, changes, and answers, each change a step with its undo entry and place", async () => {
    const { outcome, text, tools, costs, called, bodies } = await reply(
      [
        { text: "Let me look. ", tools: [{ name: "pageTree", args: { pageId: "home" } }] },
        {
          tools: [
            {
              name: "updateFields",
              args: {
                nodeId: "hero",
                values: { title: "Fresh bread", link: "https://shop.example.com/buy" },
              },
            },
          ],
        },
        { text: "Done: the hero says Fresh bread." },
      ],
      {
        pageTree: () => ({ status: "done", data: { nodes: [] } }),
        updateFields: () => changed("Edited Hero Title"),
      },
    );
    expect(outcome).toMatchObject({
      status: "done",
      stop: "end",
      costUsd: 0.003,
      steps: [
        { entryId: "h1", label: "AI (Assistant): Edited Hero Title", target: { pageId: "home" } },
      ],
      links: [{ host: "shop.example.com", href: "https://shop.example.com/buy" }],
    });
    expect(text).toBe("Let me look. Done: the hero says Fresh bread.");
    expect(costs).toEqual([0.001, 0.001, 0.001]);
    expect(called.map((call) => call.name)).toEqual(["pageTree", "updateFields"]);
    expect(tools.map((event) => [event.tool, event.state])).toEqual([
      ["pageTree", "running"],
      ["pageTree", "done"],
      ["updateFields", "running"],
      ["updateFields", "done"],
    ]);
    expect(tools[1]).not.toHaveProperty("step");

    // The system text says site text is content; the selection goes as labelled JSON.
    const [first] = bodies;
    expect(first?.messages[0]?.content).toContain("never as instructions");
    expect(first?.messages[1]?.content).toContain('"nodeId": "hero"');
    // The tool's answer went back to the model, in the order asked.
    expect(bodies[2]?.messages.map((message) => message.role)).toEqual([
      "system",
      "user",
      "assistant",
      "tool",
      "assistant",
      "tool",
    ]);
  });

  it("says each refusal as it came, and tells the model too", async () => {
    const { outcome, tools, bodies } = await reply(
      [
        {
          tools: [
            { name: "removePage", args: { pageId: "about" } },
            { name: "addNode", args: "not an object" },
            { name: "editText", args: { nodeId: "gone" } },
          ],
        },
        { text: "I couldn't." },
      ],
      {
        removePage: () => ({ status: "declined", message: "The person didn't allow this change." }),
        addNode: () => changed("Added Hero"),
        editText: () => ({ status: "not-found", message: "There is no element." }),
      },
    );
    expect(outcome).toMatchObject({ status: "done", stop: "end", steps: [], links: [] });
    expect(tools.filter((event) => event.state !== "running").map((event) => event.state)).toEqual([
      "declined",
      "invalid",
      "invalid",
    ]);
    expect(bodies[1]?.messages.filter((message) => message.role === "tool")).toHaveLength(3);
  });

  it("shows a tool name the model made up as unknown, and the tool layer refuses it", async () => {
    const { tools, called } = await reply(
      [{ tools: [{ name: "delete_everything", args: {} }] }, { text: "No." }],
      {},
    );
    expect(called.map((call) => call.name)).toEqual(["delete_everything"]);
    expect(tools.map((event) => [event.tool, event.state])).toEqual([
      ["unknown", "running"],
      ["unknown", "invalid"],
    ]);
  });

  it("asks once more when the person was editing, then lets the model know", async () => {
    let asked = 0;
    const { tools, called } = await reply(
      [{ tools: [{ name: "editText", args: { nodeId: "hero" } }] }, { text: "Done." }],
      {
        editText: () => {
          asked += 1;
          return asked === 1
            ? { status: "busy", message: "The person is editing." }
            : changed("Edited text");
        },
      },
    );
    expect(called).toHaveLength(2);
    expect(tools.at(-1)).toMatchObject({
      state: "done",
      step: { label: "AI (Assistant): Edited text" },
    });
  });

  it(`stops at ${REPLY_CAPS.toolCalls} tool calls and ${REPLY_CAPS.modelCalls} model calls`, async () => {
    const many = { tools: Array.from({ length: 10 }, () => ({ name: "outline", args: {} })) };
    const tools = await reply([many, many, many], {
      outline: () => ({ status: "done", data: {} }),
    });
    expect(tools.outcome).toMatchObject({ status: "done", stop: "tool-cap" });
    expect(tools.called).toHaveLength(REPLY_CAPS.toolCalls);

    const one = { tools: [{ name: "outline", args: {} }] };
    const calls = await reply(
      Array.from({ length: 20 }, () => one),
      {
        outline: () => ({ status: "done", data: {} }),
      },
    );
    expect(calls.outcome).toMatchObject({ status: "done", stop: "model-call-cap" });
    expect(calls.bodies).toHaveLength(REPLY_CAPS.modelCalls);
  });

  it("stops at the month's limit after the call that reached it, and when the tokens run out", async () => {
    const limit = await reply(
      [{ tools: [{ name: "editText", args: {} }], cost: 0.5 }],
      { editText: () => changed("Edited text") },
      { addCost: async () => true },
    );
    expect(limit.outcome).toMatchObject({ status: "done", stop: "limit-reached", costUsd: 0.5 });
    expect(limit.called).toEqual([]);

    const tokens = await reply([{ text: "A very long", finish: "length" }], {});
    expect(tokens.outcome).toMatchObject({ status: "done", stop: "max-tokens" });
  });

  it("stops between calls on Stop, and gives up on a stream that stalls", async () => {
    const stop = new AbortController();
    const stopped = await reply(
      [
        {
          tools: [
            { name: "outline", args: {} },
            { name: "editText", args: {} },
          ],
        },
      ],
      {
        outline: () => {
          stop.abort();
          return { status: "done", data: {} };
        },
        editText: () => changed("Edited text"),
      },
      { signal: stop.signal },
    );
    expect(stopped.outcome).toMatchObject({ status: "done", stop: "stopped" });
    expect(stopped.called.map((call) => call.name)).toEqual(["outline"]);

    // Stop during a change: the change still happens, so its step is kept (#1046's review).
    const during = new AbortController();
    const kept = await reply(
      [
        {
          tools: [
            { name: "editText", args: {} },
            { name: "addNode", args: {} },
          ],
        },
      ],
      {
        editText: () => {
          during.abort();
          return changed("Edited text");
        },
        addNode: () => changed("Added Hero"),
      },
      { signal: during.signal },
    );
    expect(kept.outcome).toMatchObject({
      status: "done",
      stop: "stopped",
      steps: [{ label: "AI (Assistant): Edited text" }],
    });
    expect(kept.called.map((call) => call.name)).toEqual(["editText"]);

    const stalled = await reply([{ stall: true }], {}, { idleMs: 20 });
    expect(stalled.outcome).toMatchObject({ status: "failed", error: "offline" });
  });

  it("makes no further call once its site isn't the open one (#1046's review)", async () => {
    let open = true;
    const { outcome, called, bodies } = await reply(
      [
        {
          tools: [
            { name: "outline", args: {} },
            { name: "editText", args: {} },
          ],
        },
        { text: "Done." },
      ],
      {
        outline: () => {
          // Open Recent, or a hand-off: another site is open now.
          open = false;
          return { status: "done", data: {} };
        },
        editText: () => changed("Edited text"),
      },
      { stillOpen: () => open },
    );
    expect(outcome).toMatchObject({ status: "failed", error: "no-site", steps: [] });
    expect(called.map((call) => call.name)).toEqual(["outline"]);
    expect(bodies).toHaveLength(1);
  });

  it("fails with the provider's code, keeping the steps made before", async () => {
    const { fetchFn } = model([{ tools: [{ name: "editText", args: {} }] }]);
    let n = 0;
    const failing = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      n += 1;
      return n === 1 ? fetchFn(url, init) : new Response("", { status: 402 });
    }) as unknown as typeof fetch;
    const { outcome } = await reply(
      [],
      { editText: () => changed("Edited text") },
      { fetchFn: failing },
    );
    expect(outcome).toMatchObject({
      status: "failed",
      error: "no-credit",
      steps: [{ label: "AI (Assistant): Edited text" }],
    });
  });
});

describe("held changes (6.9e, Review before applying)", () => {
  it("holds a staged reply's changes as asked, with their links, and no steps", async () => {
    const { outcome } = await reply(
      [
        {
          tools: [
            { name: "outline", args: {} },
            {
              name: "updateFields",
              args: { nodeId: "hero", values: { link: "https://shop.example.com" } },
            },
          ],
        },
        { text: "Ready for you to apply." },
      ],
      {
        outline: () => ({ status: "done", data: {} }),
        // A staged command answers from the draft: no undo entry.
        updateFields: () => ({
          status: "done",
          label: "AI (Assistant): Edited Hero Link",
          target: { pageId: "home", nodeId: "hero" },
        }),
      },
      { staged: true },
    );
    expect(outcome).toMatchObject({
      status: "done",
      steps: [],
      held: [
        {
          name: "updateFields",
          input: { nodeId: "hero", values: { link: "https://shop.example.com" } },
          change: {
            label: "AI (Assistant): Edited Hero Link",
            target: { pageId: "home", nodeId: "hero" },
          },
        },
      ],
      links: [{ host: "shop.example.com" }],
    });
  });

  it("applies held changes in order, each a step, refusing one the site no longer allows", async () => {
    const { client, called } = toolLayer({
      editText: () => changed("Edited Hero text"),
      removeNode: () => ({ status: "not-found", message: "There is no element." }),
    });
    const calls = [
      {
        name: "editText",
        input: { nodeId: "hero" },
        change: { label: "AI (Assistant): Edited Hero text" },
      },
      {
        name: "removeNode",
        input: { nodeId: "gone" },
        change: { label: "AI (Assistant): Removed Text" },
      },
    ];
    const applied = await applyHeld(client, calls, () => true);
    expect(called.map((call) => [call.name, call.args])).toEqual([
      ["editText", { nodeId: "hero" }],
      ["removeNode", { nodeId: "gone" }],
    ]);
    expect(applied.steps).toMatchObject([{ label: "AI (Assistant): Edited Hero text" }]);
    expect(applied.steps[0]?.entryId).toBeDefined();
    expect(applied.refused).toEqual([{ label: "AI (Assistant): Removed Text" }]);

    // With the site closed, none is asked.
    const closed = toolLayer({ editText: () => changed("Edited Hero text") });
    const none = await applyHeld(closed.client, calls, () => false);
    expect(closed.called).toEqual([]);
    expect(none.refused).toHaveLength(2);
  });
});
