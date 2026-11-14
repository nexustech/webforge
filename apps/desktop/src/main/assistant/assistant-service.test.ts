import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ASSISTANT_CONSENT_VERSION, type AssistantEvent } from "../../shared/ipc/assistant.js";
import { createAssistantService } from "./assistant-service.js";

const SESSION = "1c2d3e4f-5a6b-4c7d-8e9f-a0b1c2d3e4f5";
const PROJECT = "0b0c8f4e-2a6d-4c1e-9e10-3f6b1b2c4d5e";
const dirs: string[] = [];

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
function setUp(options: { project?: string | undefined; signIn?: "signed-in" | "cancelled" } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "webforge-assistant-"));
  dirs.push(dir);
  const keys = new Map<string, string>();
  const events: AssistantEvent[] = [];
  const opened: string[] = [];
  const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) =>
    openRouter(String(url), init),
  ) as unknown as typeof fetch;
  let month = new Date(2026, 10, 13);
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
    projectOf: (session) =>
      session === SESSION && options.project !== undefined ? options.project : undefined,
    emit: (event) => events.push(event),
    openExternal: async (url) => {
      opened.push(url);
    },
    now: () => month,
  });
  return {
    service,
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
});
