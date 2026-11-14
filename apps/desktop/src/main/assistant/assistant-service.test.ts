import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ASSISTANT_CONSENT_VERSION,
  type AssistantEvent,
  type DraftRequest,
} from "../../shared/ipc/assistant.js";
import type { ToolClient } from "./assistant-loop.js";
import { createAssistantService } from "./assistant-service.js";

const SESSION = "1c2d3e4f-5a6b-4c7d-8e9f-a0b1c2d3e4f5";
/** The site's next opening. */
const REOPENED = "2d3e4f5a-6b7c-4d8e-9fa0-b1c2d3e4f5a6";
const PROJECT = "0b0c8f4e-2a6d-4c1e-9e10-3f6b1b2c4d5e";
const dirs: string[] = [];

/** Waits for a reply's events: longer than vitest's second, for a busy computer's full run. */
const until = (check: () => void) => vi.waitFor(check, { timeout: 10_000 });

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** OpenRouter's public lists: two tool models, one of them with a ZDR endpoint. */
function openRouter(url: string, init?: RequestInit): Response {
  if (url.endsWith("/models?supported_parameters=tools")) {
    return Response.json({
      data: [
        {
          id: "anthropic/claude-model",
          name: "Anthropic: Claude Model",
          pricing: { prompt: "0.000003", completion: "0.000015" },
        },
        {
          id: "acme/keeps-everything",
          name: "Acme: Keeps Everything",
          pricing: { prompt: "0.0000001", completion: "0.0000002" },
        },
      ],
    });
  }
  if (url.endsWith("/endpoints/zdr")) {
    return Response.json({
      data: [
        { model_id: "anthropic/claude-model", supported_parameters: ["tools"] },
        {
          model_id: "acme/keeps-everything",
          supported_parameters: ["tools"],
          safety_retention: true,
        },
      ],
    });
  }
  if (url.endsWith("/key")) {
    const auth = new Headers(init?.headers).get("authorization");
    return new Response("{}", { status: auth === "Bearer sk-or-v1-good" ? 200 : 401 });
  }
  return new Response("", { status: 404 });
}

/** A service in a fresh folder, with its keys, sign-in and events in memory. */
function setUp(
  options: {
    project?: string | undefined;
    signIn?: "signed-in" | "cancelled";
    /** Answers a model call: its body and headers. */
    chat?: (body: Record<string, unknown>, headers: Headers) => Response | Promise<Response>;
    /** The tool layer's answer to each tool call by its name (6.9b): a command's runs `before`. */
    tools?: Record<string, (stage: string | undefined) => unknown>;
    /** What saving the safety version comes to: saved, at first. */
    safety?: "saved" | "held" | "failed";
  } = {},
) {
  const dir = mkdtempSync(join(tmpdir(), "webforge-assistant-"));
  dirs.push(dir);
  const keys = new Map<string, string>();
  const events: AssistantEvent[] = [];
  const opened: string[] = [];
  const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) =>
    String(url).endsWith("/chat/completions") && options.chat !== undefined
      ? options.chat(JSON.parse(String(init?.body)), new Headers(init?.headers))
      : openRouter(String(url), init),
  ) as unknown as typeof fetch;
  let month = new Date(2026, 10, 13);
  const versions: string[] = [];
  const cancelled = { count: 0 };
  /** The site open now, and its opening: another may be opened part way through a reply. */
  let project = options.project;
  let opening = SESSION;
  const connections = { open: 0 };
  const service = createAssistantService({
    dir,
    credentials: {
      get: async (key) => keys.get(key) ?? null,
      set: async (key, secret) => {
        keys.set(key, secret);
      },
      delete: async (key) => {
        keys.delete(key);
      },
    },
    signIn: {
      start: async () =>
        options.signIn === "cancelled"
          ? { status: "cancelled" }
          : { status: "signed-in", key: "sk-or-v1-from-sign-in" },
      finishWithCode: async () => ({ status: "refused" }),
      cancel: () => undefined,
    },
    fetchFn,
    appName: "Webforge",
    projectOf: (session) => (session === opening && project !== undefined ? project : undefined),
    emit: (event) => events.push(event),
    openExternal: async (url) => {
      opened.push(url);
    },
    now: () => month,
    connectTools: async (beforeCommand, stage) => {
      connections.open += 1;
      const answers = options.tools ?? {};
      return {
        client: {
          listTools: async () => ({
            tools: Object.keys(answers).map((name) => ({
              name,
              inputSchema: { type: "object" as const },
            })),
          }),
          callTool: (async ({ name }: { name: string }) => {
            // Every tool here but `outline` is a command, which saves the version first.
            if (name !== "outline") await beforeCommand();
            const answer = (await answers[name]?.(stage)) ?? {
              status: "invalid",
              message: "No such tool",
            };
            return { content: [{ type: "text", text: JSON.stringify(answer) }] };
          }) as unknown as ToolClient["callTool"],
        },
        close: async () => {
          connections.open -= 1;
        },
      };
    },
    cancelQuestions: () => {
      cancelled.count += 1;
    },
    saveVersionBefore: async (_session, name) => {
      versions.push(name);
      const status = options.safety ?? "saved";
      return status === "saved" ? { status, versionId: `version-${versions.length}` } : { status };
    },
  });
  return {
    service,
    versions,
    cancelled,
    connections,
    /** Opens another site in the window, as Open Recent does. */
    /** Back to the first site, in the same opening: as if the switch hadn't happened. */
    openBack: () => {
      project = options.project;
    },
    /** Opens the same site again, as a new opening of it (Open Recent, a hand-off). */
    reopen: () => {
      opening = REOPENED;
      project = options.project;
    },
    openOther: () => {
      project = "7d6c5b4a-3f2e-4d1c-8b0a-9f8e7d6c5b4a";
    },
    keys,
    fetchFn,
    events,
    opened,
    dir,
    nextMonth: () => {
      month = new Date(2026, 11, 2);
    },
  };
}

/** A streamed answer: each chunk as an SSE `data:` line, then `[DONE]`. */
function sse(...chunks: unknown[]): Response {
  const lines = chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("");
  return new Response(`${lines}data: [DONE]\n\n`, {
    headers: { "content-type": "text/event-stream" },
  });
}

/** A service that may send: turned on, the site's yes, signed in to OpenRouter, a model chosen. */
async function ready(options: Parameters<typeof setUp>[0] = {}) {
  const set = setUp({ project: PROJECT, ...options });
  await set.service.setEnabled(true, ASSISTANT_CONSENT_VERSION);
  await set.service.setSiteConsent(SESSION, true);
  await set.service.signIn("browser");
  await set.service.models();
  await set.service.update({ modelId: "anthropic/claude-model" });
  return set;
}

const REWRITE: DraftRequest = { kind: "rewrite", how: "shorter", text: "We are open 9 to 5." };

const BUSINESS: DraftRequest = {
  kind: "business",
  language: "en-GB",
  business: { name: "Rise Bakery", type: "bakery", about: "Sourdough, baked every morning." },
  texts: [
    { role: "Hero heading", sample: "Fresh coffee, every day" },
    { role: "Hero text", sample: "Come in and stay a while." },
  ],
};

describe("the assistant's service (6.9a, ADR 0026)", () => {
  it("starts off, signed out, with $5 a month and nothing spent", async () => {
    const { service } = setUp();
    expect(await service.status()).toMatchObject({
      enabled: false,
      consentVersion: null,
      provider: { kind: "openrouter", signedIn: false },
      reach: "openrouter",
      model: null,
      month: { spentUsd: 0, limitUsd: 5, warned: false, reached: false },
      reviewBeforeApplying: false,
    });
  });

  it("turns on with the consent shown, signs in, and keeps the key only in the credential store", async () => {
    const { service, keys, events, dir } = setUp();
    expect((await service.setEnabled(true, ASSISTANT_CONSENT_VERSION)).enabled).toBe(true);
    // An older wording isn't consent to the current one.
    expect((await service.setEnabled(true, ASSISTANT_CONSENT_VERSION - 1 || 99)).enabled).toBe(
      false,
    );
    await service.setEnabled(true, ASSISTANT_CONSENT_VERSION);

    expect(await service.signIn("browser")).toEqual({ status: "signed-in" });
    expect(keys.get("assistant/openrouter")).toBe("sk-or-v1-from-sign-in");
    expect((await service.status()).provider).toEqual({ kind: "openrouter", signedIn: true });
    expect(events.at(-1)).toMatchObject({ type: "status" });
    expect(events.at(-1)).not.toHaveProperty("session");
    expect(readFileSync(join(dir, "assistant.json"), "utf8")).not.toContain("sk-or");

    // Turn off deletes the key from this computer.
    const off = await service.setEnabled(false, ASSISTANT_CONSENT_VERSION);
    expect(off).toMatchObject({ enabled: false, provider: { signedIn: false } });
    expect(keys.size).toBe(0);
  });

  it("checks a pasted key before keeping it", async () => {
    const { service, keys } = setUp();
    expect(await service.setKey("sk-or-v1-bad")).toEqual({ status: "refused" });
    expect(keys.size).toBe(0);
    expect(await service.setKey("sk-or-v1-good")).toEqual({ status: "signed-in" });
    expect(keys.get("assistant/openrouter")).toBe("sk-or-v1-good");
  });

  it("lists OpenRouter's tool models with ZDR endpoints, with a cost per typical reply", async () => {
    const { service } = setUp();
    const listed = await service.models();
    expect(listed).toEqual({
      status: "ok",
      models: [
        {
          id: "anthropic/claude-model",
          name: "Claude Model",
          maker: "Anthropic",
          tested: false,
          zdr: true,
          // 80k tokens in at $3/M, 3k out at $15/M.
          perReplyUsd: 0.285,
          pricey: false,
        },
      ],
    });
    // Advanced allows models that may keep requests too, marked so.
    await service.update({ allowRetainingModels: true });
    const all = await service.models();
    expect(all.status === "ok" && all.models.map((model) => [model.id, model.zdr])).toEqual([
      ["acme/keeps-everything", false],
      ["anthropic/claude-model", true],
    ]);
  });

  it("turning off models that may keep requests clears one that may (AIA-7)", async () => {
    const { service } = setUp();
    await service.update({ allowRetainingModels: true });
    await service.models();
    await service.update({ modelId: "acme/keeps-everything" });
    // Off: the chosen model may keep requests, so none is chosen; nothing tested is ZDR yet.
    expect((await service.update({ allowRetainingModels: false })).model).toBeNull();

    // A ZDR model stays chosen.
    await service.update({ allowRetainingModels: true });
    await service.update({ modelId: "anthropic/claude-model" });
    expect((await service.update({ allowRetainingModels: false })).model?.id).toBe(
      "anthropic/claude-model",
    );

    // One the last list didn't hold counts as one that may keep requests.
    await service.update({ allowRetainingModels: true });
    await service.update({ modelId: "unlisted/model" });
    expect((await service.update({ allowRetainingModels: false })).model).toBeNull();

    // A model on this computer keeps nothing elsewhere, and stays chosen.
    await service.update({ provider: { kind: "ollama" }, modelId: "llama3" });
    expect((await service.update({ allowRetainingModels: false })).model?.id).toBe("llama3");
  });

  it("asks each site once unless the model is on this computer, and remembers by project", async () => {
    const { service } = setUp({ project: PROJECT });
    expect(await service.siteConsent(SESSION)).toEqual({ asked: false, allowed: false });
    await service.setSiteConsent(SESSION, true);
    expect(await service.siteConsent(SESSION)).toEqual({ asked: true, allowed: true });
    await service.setSiteConsent(SESSION, false);
    expect(await service.siteConsent(SESSION)).toEqual({ asked: true, allowed: false });

    await service.update({ provider: { kind: "ollama" } });
    expect(await service.status()).toMatchObject({
      provider: { kind: "ollama", baseUrl: "http://localhost:11434/v1" },
      reach: "this-computer",
    });
    expect(await service.siteConsent(SESSION)).toEqual({ asked: true, allowed: true });
    await service.update({ provider: { kind: "server", baseUrl: "https://ai.example.com/v1/" } });
    expect(await service.status()).toMatchObject({
      provider: { kind: "server", baseUrl: "https://ai.example.com/v1", hasKey: false },
      reach: "server",
    });
  });

  it("refuses to send without the app's and the site's yes, a sign-in, a model or budget", async () => {
    const { service } = setUp({ project: PROJECT });
    const send = () => service.send(SESSION, "Hello", {});
    expect(await service.send("9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a", "Hello", {})).toEqual({
      status: "no-site",
    });
    expect(await send()).toEqual({ status: "consent-needed" });
    await service.setEnabled(true, ASSISTANT_CONSENT_VERSION);
    expect(await send()).toEqual({ status: "consent-needed" });
    await service.setSiteConsent(SESSION, true);
    expect(await send()).toEqual({ status: "not-signed-in" });
    await service.signIn("browser");
    expect(await send()).toEqual({ status: "no-model" });
    await service.models();
    await service.update({ modelId: "anthropic/claude-model" });
    expect((await service.status()).model?.maker).toBe("Anthropic");
    await service.update({ monthlyLimitUsd: 1 });
    await service.addCost(1.2);
    expect(await send()).toEqual({ status: "limit-reached" });
  });

  it("drafts only after the same checks as a message (#873)", async () => {
    const chat = vi.fn(() => sse({ choices: [{ delta: { content: "Hi" } }] }));
    const { service } = setUp({ project: PROJECT, chat });
    expect(await service.draft("9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a", REWRITE)).toEqual({
      status: "no-site",
    });
    expect(await service.draft(SESSION, REWRITE)).toEqual({ status: "consent-needed" });
    await service.setEnabled(true, ASSISTANT_CONSENT_VERSION);
    expect(await service.draft(SESSION, REWRITE)).toEqual({ status: "consent-needed" });
    await service.setSiteConsent(SESSION, true);
    expect(await service.draft(SESSION, REWRITE)).toEqual({ status: "not-signed-in" });
    await service.signIn("browser");
    expect(await service.draft(SESSION, REWRITE)).toEqual({ status: "no-model" });
    await service.models();
    await service.update({ modelId: "anthropic/claude-model", monthlyLimitUsd: 1 });
    await service.addCost(1.2);
    expect(await service.draft(SESSION, REWRITE)).toEqual({ status: "limit-reached" });
    expect(chat).not.toHaveBeenCalled();
  });

  it("drafts with one model call: no tools, OpenRouter's privacy, the cost counted (#873)", async () => {
    const asked: { body: Record<string, unknown>; headers: Headers }[] = [];
    const { service } = await ready({
      chat: (body, headers) => {
        asked.push({ body, headers });
        return sse(
          { choices: [{ delta: { content: '"Warm sourdough, ' } }] },
          { choices: [{ delta: { content: 'baked every morning."' }, finish_reason: "stop" }] },
          { choices: [], usage: { prompt_tokens: 90, completion_tokens: 12, cost: 0.002 } },
        );
      },
    });

    expect(await service.draft(SESSION, REWRITE)).toEqual({
      status: "ok",
      texts: ["Warm sourdough, baked every morning."],
      costUsd: 0.002,
    });
    expect(asked).toHaveLength(1);
    const [{ body, headers }] = asked as [(typeof asked)[0]];
    expect(body.tools).toBeUndefined();
    expect(body).toMatchObject({
      model: "anthropic/claude-model",
      provider: { zdr: true, data_collection: "deny" },
    });
    expect(headers.get("authorization")).toBe("Bearer sk-or-v1-from-sign-in");
    expect(headers.get("x-openrouter-title")).toBe("Webforge");
    expect((await service.status()).month.spentUsd).toBeCloseTo(0.002);
  });

  it("says an answer it can't use, and counts what the provider billed for it (#873)", async () => {
    const { service } = await ready({
      chat: () =>
        sse(
          { choices: [{ delta: { content: '["Only one text"]' } }] },
          { choices: [], usage: { cost: 0.01 } },
        ),
    });
    expect(await service.draft(SESSION, BUSINESS)).toEqual({ status: "provider-error" });
    expect((await service.status()).month.spentUsd).toBeCloseTo(0.01);
  });

  it("passes on the provider's refusal, as its code (#873)", async () => {
    const { service } = await ready({ chat: () => new Response("", { status: 402 }) });
    expect(await service.draft(SESSION, REWRITE)).toEqual({ status: "no-credit" });
  });

  it("drafts one at a time for a site (#873)", async () => {
    const waiting: ((response: Response) => void)[] = [];
    const { service } = await ready({
      chat: () => new Promise<Response>((resolve) => waiting.push(resolve)),
    });
    const answer = async (text: string) => {
      await until(() => expect(waiting).toHaveLength(1));
      waiting.pop()?.(sse({ choices: [{ delta: { content: text } }] }));
    };
    const first = service.draft(SESSION, REWRITE);
    await until(() => expect(waiting).toHaveLength(1));
    expect(await service.draft(SESSION, REWRITE)).toEqual({ status: "busy" });
    await answer("Open daily.");
    expect(await first).toMatchObject({ status: "ok", texts: ["Open daily."] });
    // The first has answered: the next may go.
    const next = service.draft(SESSION, REWRITE);
    await answer("Open every day.");
    expect(await next).toMatchObject({ status: "ok", texts: ["Open every day."] });
  });

  it("adds each reply's cost to the month, says 80% and the limit once, and starts afresh", async () => {
    const { service, events, nextMonth } = setUp();
    await service.addCost(2);
    expect(events.filter((event) => event.type === "limit")).toEqual([]);
    expect((await service.addCost(2.1)).warned).toBe(true);
    await service.addCost(0.1);
    const limits = () => events.flatMap((event) => (event.type === "limit" ? [event.level] : []));
    expect(limits()).toEqual(["warning"]);
    expect((await service.addCost(1)).reached).toBe(true);
    expect(limits()).toEqual(["warning", "reached"]);

    nextMonth();
    expect((await service.status()).month).toEqual({
      spentUsd: 0,
      limitUsd: 5,
      warned: false,
      reached: false,
    });
  });

  it("says a sign-in that didn't finish, and keeps nothing", async () => {
    const { service, keys } = setUp({ signIn: "cancelled" });
    expect(await service.signIn("code")).toEqual({ status: "cancelled" });
    expect(keys.size).toBe(0);
  });

  it("asks for consent again when requests would go somewhere it wasn't given for (#992)", async () => {
    const { service } = setUp({ project: PROJECT });
    await service.update({ provider: { kind: "ollama" } });
    expect(await service.setEnabled(true, ASSISTANT_CONSENT_VERSION)).toMatchObject({
      enabled: true,
      consentReach: { reach: "this-computer" },
    });

    // A consent that said nothing leaves the computer isn't one for OpenRouter.
    await service.update({ provider: { kind: "openrouter" } });
    await service.signIn("browser");
    await service.setSiteConsent(SESSION, true);
    expect(await service.status()).toMatchObject({
      enabled: false,
      consentVersion: ASSISTANT_CONSENT_VERSION,
      consentReach: { reach: "this-computer" },
      reach: "openrouter",
    });
    expect(await service.send(SESSION, "Hello", {})).toEqual({ status: "consent-needed" });

    // Agreed for OpenRouter: it covers OpenRouter, and a model on this computer, but not a server.
    await service.setEnabled(true, ASSISTANT_CONSENT_VERSION);
    expect((await service.status()).consentReach).toEqual({ reach: "openrouter" });
    await service.update({ provider: { kind: "lmstudio" } });
    expect((await service.status()).enabled).toBe(true);
    await service.update({ provider: { kind: "server", baseUrl: "https://ai.example.com/v1" } });
    expect((await service.status()).enabled).toBe(false);

    // A server's consent is for its host.
    await service.setEnabled(true, ASSISTANT_CONSENT_VERSION);
    expect((await service.status()).consentReach).toEqual({
      reach: "server",
      host: "ai.example.com",
    });
    await service.update({ provider: { kind: "server", baseUrl: "https://other.example.com/v1" } });
    expect((await service.status()).enabled).toBe(false);
  });

  it("opens only a web address the reply holds, from main's own conversation", async () => {
    const { service, opened } = setUp({ project: PROJECT });
    const REPLY = "2d3e4f5a-6b7c-4d8e-9fa0-b1c2d3e4f5a6";
    service.conversations.set(PROJECT, [
      {
        replyId: REPLY,
        message: "Where do I check my listing?",
        reply:
          "See [your listing](https://business.example.com/bakery), or https://maps.example.com.",
        state: "done",
        costUsd: 0.01,
        steps: [],
        links: [{ host: "shop.example.com", href: "https://shop.example.com/pay" }],
      },
    ]);
    const open = (href: string, reply = REPLY, session = SESSION) =>
      service.openLink(session, reply, href);

    // Each as the reply wrote it (the panel's Markdown token's href), opened as the panel shows it.
    expect(await open("https://business.example.com/bakery")).toEqual({ status: "opened" });
    expect(await open("https://maps.example.com")).toEqual({ status: "opened" });
    expect(await open("https://shop.example.com/pay")).toEqual({ status: "opened" });
    expect(opened).toEqual([
      "https://business.example.com/bakery",
      "https://maps.example.com/",
      "https://shop.example.com/pay",
    ]);

    // Not in the reply; not on the web; an unknown reply; a session that isn't the open site's.
    expect(await open("https://evil.example/steal")).toEqual({ status: "refused" });
    expect(await open("javascript:alert(1)")).toEqual({ status: "refused" });
    expect(await open("file:///C:/Windows/System32/calc.exe")).toEqual({ status: "refused" });
    expect(
      await open("https://business.example.com/bakery", "9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a"),
    ).toEqual({
      status: "refused",
    });
    expect(
      await open(
        "https://business.example.com/bakery",
        REPLY,
        "9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a",
      ),
    ).toEqual({ status: "refused" });
    expect(opened).toHaveLength(3);

    // The conversation goes with New conversation, and so do its links.
    await service.newConversation(SESSION);
    expect(await service.conversation(SESSION)).toEqual([]);
    expect(await open("https://business.example.com/bakery")).toEqual({ status: "refused" });
  });

  it("never keeps a key for a server over plain http that isn't on this computer (#976)", async () => {
    const { service, keys } = setUp();
    await service.update({ provider: { kind: "server", baseUrl: "http://ai.example.com/v1" } });
    expect(await service.setKey("sk-secret")).toEqual({ status: "insecure-server" });
    expect(keys.size).toBe(0);
  });

  it("never sends a server's key to another address (#870's review)", async () => {
    const { service, keys, fetchFn } = setUp();
    await service.update({ provider: { kind: "server", baseUrl: "https://ai.example.com/v1" } });
    keys.set("assistant/server", "sk-for-ai-example");
    expect((await service.status()).provider).toMatchObject({ hasKey: true });

    // Another address forgets the key: it was given for the first server.
    await service.update({ provider: { kind: "server", baseUrl: "https://other.example/v1" } });
    expect(keys.has("assistant/server")).toBe(false);
    expect((await service.status()).provider).toMatchObject({ hasKey: false });

    // And a key at a plain http address on another computer is never sent with the model list.
    await service.update({ provider: { kind: "server", baseUrl: "http://ai.example.com/v1" } });
    keys.set("assistant/server", "sk-planted");
    expect(await service.models()).toEqual({ status: "insecure-server" });
    expect(vi.mocked(fetchFn).mock.calls.map(([url]) => String(url))).not.toContain(
      "http://ai.example.com/v1/models",
    );
  });
  it("runs a reply: its steps, the conversation's safety version once, and how it ended (6.9b)", async () => {
    let calls = 0;
    const { service, events, versions, connections } = await ready({
      chat: () => {
        calls += 1;
        return calls % 2 === 1
          ? sse(toolCall("editText", { nodeId: "hero" }), finished("tool_calls"))
          : sse({ choices: [{ delta: { content: "Done." } }] }, finished("stop"));
      },
      tools: {
        editText: () => ({
          status: "done",
          label: "AI (Assistant): Edited Hero text",
          entryId: `h${calls}`,
          target: { pageId: "home", nodeId: "hero" },
        }),
      },
    });

    // One reply at a time for a site, even for two messages sent at once.
    const [sent, second] = await Promise.all([
      service.send(SESSION, "Say Fresh bread", { pageId: "home" }),
      service.send(SESSION, "And another", {}),
    ]);
    if (sent.status !== "sending") throw new Error(`not sent: ${sent.status}`);
    expect(second).toEqual({ status: "busy" });
    await until(() => expect(events.at(-1)?.type).toBe("reply-done"));
    const replied = events.filter((event) => "replyId" in event && event.replyId === sent.replyId);
    expect(replied.map((event) => event.type)).toEqual([
      "reply-started",
      "tool",
      "safety-version",
      "tool",
      "text",
      "reply-done",
    ]);
    expect(events.at(-1)).toMatchObject({
      stop: "end",
      steps: [{ entryId: "h1", label: "AI (Assistant): Edited Hero text" }],
    });
    expect(versions).toEqual(["Before the assistant's changes"]);
    expect(connections.open).toBe(0);
    const [turn] = await service.conversation(SESSION);
    expect(turn).toMatchObject({
      message: "Say Fresh bread",
      reply: "Done.",
      state: "done",
      stop: "end",
      safetyVersion: { versionId: "version-1", label: "Before the assistant's changes" },
    });

    // The same conversation's next change saves no other version; a new conversation's does.
    await service.send(SESSION, "Again", {});
    await until(() =>
      expect(events.filter((event) => event.type === "reply-done")).toHaveLength(2),
    );
    expect(versions).toHaveLength(1);
    await service.newConversation(SESSION);
    await service.send(SESSION, "Once more", {});
    await until(() =>
      expect(events.filter((event) => event.type === "reply-done")).toHaveLength(3),
    );
    expect(versions).toHaveLength(2);
  });

  it("makes no change to a site opened part way through a reply (#1046's review)", async () => {
    let calls = 0;
    const commands: string[] = [];
    const set = await ready({
      chat: () => {
        calls += 1;
        // The person opens another site while the model is thinking.
        set.openOther();
        return sse(toolCall("editText", { nodeId: "hero" }), finished("tool_calls"));
      },
      tools: {
        editText: () => {
          commands.push("editText");
          return { status: "done", label: "AI (Assistant): Edited text", entryId: "h1" };
        },
      },
    });
    const sent = await set.service.send(SESSION, "Change the hero", {});
    expect(sent.status).toBe("sending");
    await until(() => expect(set.events.at(-1)?.type).toBe("reply-failed"));
    expect(set.events.at(-1)).toMatchObject({ error: "no-site", steps: [] });
    expect(calls).toBe(1);
    expect(commands).toEqual([]);
    expect(set.versions).toEqual([]);
  });

  it("keeps a recent version as the conversation's safety version, saving no other (#1046's review)", async () => {
    let n = 0;
    const { service, events, versions } = await ready({
      safety: "held",
      chat: () => {
        n += 1;
        return n % 2 === 1
          ? sse(toolCall("editText", {}), finished("tool_calls"))
          : sse({ choices: [{ delta: { content: "Done." } }] }, finished("stop"));
      },
      tools: {
        editText: () => ({
          status: "done",
          label: "AI (Assistant): Edited text",
          entryId: `h${n}`,
        }),
      },
    });
    await service.send(SESSION, "One", {});
    await until(() =>
      expect(events.filter((event) => event.type === "reply-done")).toHaveLength(1),
    );
    await service.send(SESSION, "Two", {});
    await until(() =>
      expect(events.filter((event) => event.type === "reply-done")).toHaveLength(2),
    );
    expect(versions).toHaveLength(1);
    expect(events.some((event) => event.type === "safety-version")).toBe(false);
    expect((await service.conversation(SESSION))[0]).not.toHaveProperty("safetyVersion");
  });

  it("stops a reply on Stop, before its next call", async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { service, events, fetchFn, cancelled } = await ready({
      chat: () => sse(toolCall("outline", {}), finished("tool_calls")),
      tools: { outline: () => held.then(() => ({ status: "done", data: {} })) },
    });
    const sent = await service.send(SESSION, "Look around", {});
    if (sent.status !== "sending") throw new Error("not sent");
    await until(() => expect(events.some((event) => event.type === "tool")).toBe(true));
    await service.stop(sent.replyId);
    // A question the window asks for the reply's command closes (D7), declined.
    expect(cancelled.count).toBe(1);
    release();
    await until(() => expect(events.at(-1)?.type).toBe("reply-done"));
    expect(events.at(-1)).toMatchObject({ stop: "stopped" });
    // One model call: none after Stop.
    const chats = vi
      .mocked(fetchFn)
      .mock.calls.filter(([url]) => String(url).endsWith("/chat/completions"));
    expect(chats).toHaveLength(1);
  });
});

/** A streamed tool call, its arguments whole. */
function toolCall(name: string, args: unknown) {
  return {
    choices: [
      {
        delta: {
          tool_calls: [
            { index: 0, id: "call-1", function: { name, arguments: JSON.stringify(args) } },
          ],
        },
      },
    ],
  };
}

/** A model call's end, with its cost. */
function finished(reason: string) {
  return { choices: [{ delta: {}, finish_reason: reason }], usage: { cost: 0.001 } };
}

describe("Review before applying (6.9e)", () => {
  /** A reply that edits the hero once, then says so; its answer a draft's while staged. */
  const editing = () => {
    let calls = 0;
    let entry = 0;
    return {
      chat: () => {
        calls += 1;
        return calls % 2 === 1
          ? sse(toolCall("editText", { nodeId: "hero" }), finished("tool_calls"))
          : sse({ choices: [{ delta: { content: "Done." } }] }, finished("stop"));
      },
      tools: {
        editText: (stage: string | undefined) => {
          if (stage !== undefined) {
            return {
              status: "done",
              label: "AI (Assistant): Edited Hero text",
              target: { pageId: "home" },
            };
          }
          entry += 1;
          return {
            status: "done",
            label: "AI (Assistant): Edited Hero text",
            entryId: `h${entry}`,
            target: { pageId: "home" },
          };
        },
      },
    };
  };

  it("holds a reply's changes until they're applied, each then a step, the version saved first", async () => {
    const { service, events, versions } = await ready(editing());
    expect((await service.update({ reviewBeforeApplying: true })).reviewBeforeApplying).toBe(true);
    const sent = await service.send(SESSION, "Change the hero", {});
    if (sent.status !== "sending") throw new Error("not sent");
    await until(() => expect(events.at(-1)?.type).toBe("reply-done"));
    expect(events.at(-1)).toMatchObject({
      steps: [],
      held: [{ label: "AI (Assistant): Edited Hero text", target: { pageId: "home" } }],
    });
    // Nothing changed yet: no version, and the turn holds the change.
    expect(versions).toEqual([]);
    expect((await service.conversation(SESSION))[0]?.held).toHaveLength(1);

    expect(await service.applyHeld(SESSION, sent.replyId)).toEqual({ status: "applied" });
    expect(events.at(-1)).toMatchObject({
      type: "held",
      replyId: sent.replyId,
      state: "applied",
      steps: [{ entryId: "h1", label: "AI (Assistant): Edited Hero text" }],
      refused: [],
    });
    expect(versions).toEqual(["Before the assistant's changes"]);
    const [turn] = await service.conversation(SESSION);
    expect(turn?.steps).toMatchObject([{ entryId: "h1" }]);
    expect(turn).not.toHaveProperty("held");
    expect(await service.applyHeld(SESSION, sent.replyId)).toEqual({ status: "nothing-held" });
  });

  it("never keeps held changes past a site switch or another opening of the site", async () => {
    // The person opens another site while the reply works: nothing is held.
    let calls = 0;
    const switching = await ready({
      chat: () => {
        calls += 1;
        if (calls === 2) switching.openOther();
        return sse(toolCall("editText", { nodeId: "hero" }), finished("tool_calls"));
      },
      tools: {
        editText: () => ({ status: "done", label: "AI (Assistant): Edited Hero text" }),
      },
    });
    await switching.service.update({ reviewBeforeApplying: true });
    const sent = await switching.service.send(SESSION, "Change the hero", {});
    if (sent.status !== "sending") throw new Error("not sent");
    await until(() => expect(switching.events.at(-1)?.type).toBe("reply-failed"));
    switching.openBack();
    expect(await switching.service.applyHeld(SESSION, sent.replyId)).toEqual({
      status: "nothing-held",
    });

    // Held, then the site opened again: its draft went with the window, so they go too.
    const reopened = await ready(editing());
    await reopened.service.update({ reviewBeforeApplying: true });
    const held = await reopened.service.send(SESSION, "Change the hero", {});
    if (held.status !== "sending") throw new Error("not sent");
    await until(() => expect(reopened.events.at(-1)?.type).toBe("reply-done"));
    reopened.reopen();
    expect(await reopened.service.applyHeld(REOPENED, held.replyId)).toEqual({
      status: "nothing-held",
    });
    expect((await reopened.service.conversation(REOPENED))[0]).not.toHaveProperty("held");
    expect(reopened.versions).toEqual([]);
  });

  it("discards held changes, changing nothing, and holds only the last reply's", async () => {
    const { service, events, versions } = await ready(editing());
    await service.update({ reviewBeforeApplying: true });
    const first = await service.send(SESSION, "Change the hero", {});
    if (first.status !== "sending") throw new Error("not sent");
    await until(() => expect(events.filter((each) => each.type === "reply-done")).toHaveLength(1));
    const second = await service.send(SESSION, "And again", {});
    if (second.status !== "sending") throw new Error("not sent");
    await until(() => expect(events.filter((each) => each.type === "reply-done")).toHaveLength(2));
    // The window's draft is the last reply's: the first's changes are no longer held.
    expect(await service.applyHeld(SESSION, first.replyId)).toEqual({ status: "nothing-held" });

    await service.discardHeld(SESSION, second.replyId);
    expect(events.at(-1)).toMatchObject({
      type: "held",
      state: "discarded",
      steps: [],
      refused: [],
    });
    expect(versions).toEqual([]);
    expect(await service.applyHeld(SESSION, second.replyId)).toEqual({ status: "nothing-held" });
  });
});
