import { type MessageKey, t } from "@webforge/i18n";
import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiRequest } from "../shared/ipc/ai.js";
import { PREVIEW_OPEN_WAIT_MS } from "../shared/ipc/preview.js";
import { type AiWindow, exposeForE2eTests, registerAiHandlers } from "./ai-ipc.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

/** The bridge, its window's sent messages, and its handlers called as from a renderer. */
function bridge(options: { trusted?: boolean; window?: AiWindow | undefined } = {}) {
  const registered = new Map<string, Handler>();
  const ipc = {
    handle: (name: string, handler: Handler) => registered.set(name, handler),
  } as unknown as Pick<IpcMain, "handle">;
  const sent: unknown[][] = [];
  const crashed = { value: false };
  type Load = (details: { isMainFrame: boolean; isSameDocument: boolean }) => void;
  const loads: Load[] = [];
  /** What the window calls once it has closed, or its renderer has gone. */
  const gone: (() => void)[] = [];
  const window: AiWindow = {
    webContents: {
      send: (...args) => sent.push(args),
      isCrashed: () => crashed.value,
      on: ((event: string, listener: Load & (() => void)) => {
        if (event === "did-start-navigation") loads.push(listener);
        else gone.push(listener);
      }) as AiWindow["webContents"]["on"],
    },
  };
  // The opening of the site that is open now.
  const open = { sessionId: SESSION as string | undefined };
  const ai = registerAiHandlers(
    ipc,
    () => options.trusted ?? true,
    () => ("window" in options ? options.window : window),
    {
      staleReason: (sessionId) =>
        open.sessionId === undefined
          ? "no-site"
          : sessionId === open.sessionId
            ? undefined
            : "stale-session",
    },
    { queryMs: 1_000, commandMs: 2_000, answerWithinMs: 45_000, keepMs: 30 * 60_000 },
  );
  /** The window starts loading a page: a reload, or only a part of the same one. */
  const load = (isSameDocument = false) => {
    for (const listener of loads) listener({ isMainFrame: true, isSameDocument });
  };
  const invoke = (channel: string, ...args: unknown[]) =>
    registered.get(channel)?.({ senderFrame: { url: "app" } } as IpcMainInvokeEvent, ...args);
  return { ai, sent, crashed, invoke, open, load, loads, gone };
}

/** The opening of the site the window was loaded for. */
const SESSION = "11111111-1111-4111-8111-111111111111";

const outline: AiRequest = { kind: "query", name: "outline", input: {} };
const addHero: AiRequest = {
  kind: "command",
  name: "addNode",
  input: { type: "Hero" },
  app: "Claude",
};

/** A paired app (5.35), by its id, and its command, which names it. */
const CLAUDE = "0b0c8f4e-2a6d-4c1e-9e10-3f6b1b2c4d5e";
const plan: AiRequest = {
  kind: "command",
  name: "plan",
  input: { title: "Build out the five pages", commands: [] },
  app: "Claude",
  appId: CLAUDE,
};

afterEach(() => {
  vi.useRealTimers();
});

/**
 * An answer the bridge gives itself, worded by `key`: each names the app as it's called (#1004), so
 * a renamed app's answers carry its new name.
 */
function said(status: string, key: MessageKey) {
  const message = t(key);
  expect(message).toContain(t("app.name"));
  expect(message).not.toContain("{appName}");
  return { status, message };
}

describe("registerAiHandlers", () => {
  it("forwards a request to the window and resolves with its answer", async () => {
    const { ai, sent, invoke } = bridge();
    await invoke("ai:listening", SESSION, true);
    const answer = ai.ask(addHero);
    expect(sent).toEqual([["ai:request", 1, addHero]]);
    await invoke("ai:answer", 1, { status: "done", label: "AI (Claude): Added Hero", id: "n1" });
    expect(await answer).toEqual({ status: "done", label: "AI (Claude): Added Hero", id: "n1" });

    const second = ai.ask(outline);
    await invoke("ai:answer", 2, { status: "done", data: { name: "Rosa's" } });
    // An answer to a request no one waits for any more changes nothing.
    await invoke("ai:answer", 1, { status: "busy", message: "late" });
    expect(await second).toEqual({ status: "done", data: { name: "Rosa's" } });
  });

  it("cancels an app's commands waiting for the window, by its id and only its (6.9b)", async () => {
    const { ai, sent, invoke } = bridge();
    await invoke("ai:listening", SESSION, true);
    const assistant = ai.ask({ ...addHero, app: "Assistant" }, "assistant");
    // A paired app's question stays, whatever its name: only the id counts (#1050's review).
    const claude = ai.ask(addHero, "0b0c8f4e-2a6d-4c1e-9e10-3f6b1b2c4d5e");
    ai.ask(outline, "assistant");
    sent.length = 0;
    ai.cancel("assistant");
    expect(sent).toEqual([["ai:cancel", 1]]);
    // It still answers, as the window declines it.
    await invoke("ai:answer", 1, { status: "declined", message: "Stopped." });
    expect(await assistant).toEqual({ status: "declined", message: "Stopped." });
    sent.length = 0;
    ai.cancel("assistant");
    expect(sent).toEqual([]);
    await invoke("ai:answer", 2, { status: "done", label: "AI (Claude): Added Hero" });
    expect((await claude).status).toBe("done");
  });

  it("says no site is open until the renderer listens, and after it stops or crashes", async () => {
    const { ai, sent, crashed, invoke } = bridge();
    expect(await ai.ask(outline)).toEqual(said("not-found", "aiApps.answer.noSite"));
    await invoke("ai:listening", SESSION, true);
    crashed.value = true;
    expect((await ai.ask(outline)).status).toBe("not-found");
    crashed.value = false;
    await invoke("ai:listening", SESSION, false);
    expect((await ai.ask(outline)).status).toBe("not-found");
    expect(sent).toEqual([]);

    const closed = bridge({ window: undefined });
    await closed.invoke("ai:listening", SESSION, true);
    expect((await closed.ai.ask(outline)).status).toBe("not-found");
  });

  it("settles waiting requests as not-found at once when the window reloads, and sends no more (#663)", async () => {
    const { ai, sent, invoke, load } = bridge();
    await invoke("ai:listening", SESSION, true);
    const query = ai.ask(outline);
    const command = ai.ask(addHero);
    load(true);
    // Only a part of the page: still listening.
    expect(sent).toHaveLength(2);

    load();
    expect(await query).toEqual(said("not-found", "aiApps.answer.reloaded"));
    expect(await command).toEqual(said("not-found", "aiApps.answer.reloaded"));
    // Its answers, if they come, change nothing; and nothing more is sent until it listens again.
    await invoke("ai:answer", 1, { status: "done", data: {} });
    expect((await ai.ask(outline)).status).toBe("not-found");
    expect(sent).toHaveLength(2);
    await invoke("ai:listening", SESSION, true);
    void ai.ask(outline);
    expect(sent).toHaveLength(3);
  });

  it("sends nothing for an opening of the site a hand-off has replaced (#663)", async () => {
    const { ai, sent, invoke, open } = bridge();
    await invoke("ai:listening", SESSION, true);
    open.sessionId = "22222222-2222-4222-8222-222222222222";
    expect((await ai.ask(addHero)).status).toBe("not-found");
    open.sessionId = undefined;
    expect((await ai.ask(addHero)).status).toBe("not-found");
    expect(sent).toEqual([]);
  });

  it("stops listening only for the opening that listens, and watches each window once", async () => {
    const { ai, sent, invoke, loads } = bridge();
    await invoke("ai:listening", SESSION, true);
    await invoke("ai:listening", "22222222-2222-4222-8222-222222222222", false);
    void ai.ask(outline);
    expect(sent).toHaveLength(1);
    await invoke("ai:listening", SESSION, true);
    expect(loads).toHaveLength(1);
  });

  it("lets a command wait for the person however long it takes, once the window is asking (5.34)", async () => {
    vi.useFakeTimers();
    const { ai, invoke } = bridge();
    await invoke("ai:listening", SESSION, true);
    let settled = false;
    const command = ai.ask(addHero).finally(() => {
      settled = true;
    });
    await invoke("ai:asking", 1);
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    expect(settled).toBe(false);
    await invoke("ai:answer", 1, { status: "done", label: "AI (Claude): Added Hero" });
    expect((await command).status).toBe("done");
    // One no longer waiting changes nothing.
    await invoke("ai:asking", 1);
  });

  it("ends a request still waiting once its site closes or its window goes, as no decline (5.34)", async () => {
    const { ai, invoke, gone } = bridge();
    await invoke("ai:listening", SESSION, true);
    const command = ai.ask(addHero);
    await invoke("ai:asking", 1);
    await invoke("ai:listening", SESSION, false);
    expect(await command).toEqual(said("not-found", "aiApps.answer.siteClosed"));

    await invoke("ai:listening", SESSION, true);
    const another = ai.ask(addHero);
    await invoke("ai:asking", 2);
    for (const listener of gone) listener();
    expect(await another).toEqual(said("not-found", "aiApps.answer.siteClosed"));
    // Gone, it listens no more.
    expect((await ai.ask(outline)).status).toBe("not-found");
  });

  it("tells a paired app its change waits by id before its call gives up, and the outcome later (#1364)", async () => {
    vi.useFakeTimers();
    const { ai, invoke } = bridge();
    await invoke("ai:listening", SESSION, true);
    const late = vi.fn();
    const command = ai.ask(plan, CLAUDE, late);
    await invoke("ai:asking", 1);
    await vi.advanceTimersByTimeAsync(44_999);
    await invoke("ai:answer", 99, { status: "done", data: {} });
    // Before an MCP client's 60 s, it's told the change's id, and the question stays.
    await vi.advanceTimersByTimeAsync(1);
    const waiting = {
      status: "waiting",
      data: { changeId: 1 },
      message: t("aiApps.answer.waiting"),
    };
    expect(await command).toEqual(waiting);
    expect(waiting.message).toContain(t("app.name"));
    expect(ai.changeStatus({ changeId: 1 }, CLAUDE)).toEqual(waiting);
    // The app's call would have timed out long before the person answers.
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    expect(ai.changeStatus({ changeId: 1 }, CLAUDE)).toEqual(waiting);

    const made = { status: "done", label: "AI (Claude): Build out the five pages" } as const;
    expect(late).not.toHaveBeenCalled();
    await invoke("ai:answer", 1, made);
    expect(ai.changeStatus({ changeId: 1 }, CLAUDE)).toEqual(made);
    // The app's limits hear the person's answer too.
    expect(late).toHaveBeenCalledExactlyOnceWith(made);
    // Read as often as the app asks, by that app alone, for half an hour.
    expect(ai.changeStatus({ changeId: 1 }, CLAUDE)).toEqual(made);
    expect(ai.changeStatus({ changeId: 1 }, "4c1e9e10-0b0c-4f4e-8a6d-3f6b1b2c4d5e")).toEqual(
      said("not-found", "aiApps.answer.noChange"),
    );
    await vi.advanceTimersByTimeAsync(30 * 60_000);
    expect(ai.changeStatus({ changeId: 1 }, CLAUDE)).toEqual(
      said("not-found", "aiApps.answer.noChange"),
    );
    expect(ai.changeStatus({ changeId: "1" }, CLAUDE).status).toBe("invalid");
  });

  it("never makes a change sent again while the person decides twice (#1364)", async () => {
    const { ai, invoke, sent } = bridge();
    await invoke("ai:listening", SESSION, true);
    const late = vi.fn();
    const first = ai.ask(plan, CLAUDE, late);
    // Sent again before it's asked: the window may still refuse it, so this one waits its turn.
    expect(await ai.ask(plan, CLAUDE)).toEqual(said("busy", "aiApps.answer.tooMany"));
    await invoke("ai:asking", 1);
    sent.length = 0;

    expect(await ai.ask(plan, CLAUDE)).toEqual({
      ...said("waiting", "aiApps.answer.sentAgain"),
      data: { changeId: 1 },
    });
    // Another change of the app's waits for the person's answer to this one.
    expect(await ai.ask({ ...plan, input: { title: "Other", commands: [] } }, CLAUDE)).toEqual(
      said("busy", "aiApps.answer.anotherWaits"),
    );
    expect(sent).toEqual([]);

    const made = { status: "done", label: "AI (Claude): Build out the five pages" } as const;
    await invoke("ai:answer", 1, made);
    // The first call still open hears it, once, and so does changeStatus.
    expect(await first).toEqual(made);
    expect(late).not.toHaveBeenCalled();
    expect(ai.changeStatus({ changeId: 1 }, CLAUDE)).toEqual(made);
    // Once answered, the same change may be sent again: it's a new one.
    void ai.ask(plan, CLAUDE);
    expect(sent).toEqual([["ai:request", 2, plan]]);
  });

  it("keeps the question once the app has its id, until the site closes (#1364)", async () => {
    vi.useFakeTimers();
    const { ai, invoke, sent } = bridge();
    await invoke("ai:listening", SESSION, true);
    const command = ai.ask(plan, CLAUDE);
    await invoke("ai:asking", 1);
    await vi.advanceTimersByTimeAsync(45_000);
    expect((await command).status).toBe("waiting");
    sent.length = 0;
    // The app's connection closing gives up on nothing: it has the change's id.
    ai.cancel(CLAUDE);
    expect(sent).toEqual([]);

    await invoke("ai:listening", SESSION, false);
    expect(ai.changeStatus({ changeId: 1 }, CLAUDE)).toEqual(
      said("not-found", "aiApps.answer.siteClosed"),
    );
  });

  it("answers no waiting for a question asked for the assistant, which waits in its panel", async () => {
    vi.useFakeTimers();
    const { ai, invoke } = bridge();
    await invoke("ai:listening", SESSION, true);
    let settled = false;
    void ai.ask({ ...addHero, app: "Assistant" }, "assistant").finally(() => {
      settled = true;
    });
    await invoke("ai:asking", 1);
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    expect(settled).toBe(false);
  });

  it("gives up on a query sooner than on a command, which may wait for the person (D7)", async () => {
    vi.useFakeTimers();
    const { ai, invoke } = bridge();
    await invoke("ai:listening", SESSION, true);
    const query = ai.ask(outline);
    const command = ai.ask(addHero);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(await query).toEqual(said("busy", "aiApps.answer.noAnswer"));
    await invoke("ai:answer", 2, { status: "declined", message: "No" });
    expect((await command).status).toBe("declined");

    const slow = ai.ask(addHero);
    await vi.advanceTimersByTimeAsync(2_000);
    expect((await slow).status).toBe("busy");
  });

  it("waits on openPreview as long as the preview may take to open, past a query's time (#1255)", async () => {
    vi.useFakeTimers();
    const { ai, invoke } = bridge();
    await invoke("ai:listening", SESSION, true);
    const opening = ai.ask({ kind: "query", name: "openPreview", input: {} });
    // The person answers the question about code to trust, and the first build finishes.
    await vi.advanceTimersByTimeAsync(PREVIEW_OPEN_WAIT_MS);
    const address = "http://127.0.0.1:54321/0123456789abcdef/index.html";
    await invoke("ai:answer", 1, { status: "done", data: { opened: true, address } });
    expect(await opening).toEqual({ status: "done", data: { opened: true, address } });

    // Still answered for, a while after the preview gives up.
    const never = ai.ask({ kind: "query", name: "openPreview", input: {} });
    await vi.advanceTimersByTimeAsync(PREVIEW_OPEN_WAIT_MS + 5_000);
    expect(await never).toEqual(said("busy", "aiApps.answer.noAnswer"));
  });

  it("is on main's globals only in an unpackaged app the E2E tests launch", () => {
    const { ai } = bridge();
    const exposed = () => "webforgeAi" in globalThis;
    try {
      exposeForE2eTests(ai, true, { WEBFORGE_E2E_AI: "1" });
      expect(exposed()).toBe(false);
      exposeForE2eTests(ai, false, {});
      expect(exposed()).toBe(false);
      exposeForE2eTests(ai, false, { WEBFORGE_E2E_AI: "1" });
      expect(exposed()).toBe(true);
    } finally {
      Reflect.deleteProperty(globalThis, "webforgeAi");
    }
  });

  it("refuses a renderer it does not trust, and answers outside the contract", async () => {
    const { invoke } = bridge({ trusted: false });
    await expect(invoke("ai:listening", SESSION, true)).rejects.toThrow();
    const trusted = bridge();
    await expect(trusted.invoke("ai:answer", 1, { status: "maybe" })).rejects.toThrow();
  });

  it("lets one command per app and a few queries wait, answering the rest busy at once (S21)", async () => {
    const { ai, sent, invoke } = bridge();
    await invoke("ai:listening", SESSION, true);
    const first = ai.ask(addHero);
    // The same app's next command waits for the first; another app's goes.
    expect(await ai.ask(addHero)).toEqual(said("busy", "aiApps.answer.tooMany"));
    void ai.ask({ ...addHero, app: "Copilot" });
    const queries = [0, 1, 2, 3].map(() => ai.ask(outline));
    expect(await ai.ask(outline)).toMatchObject({ status: "busy" });
    expect(sent).toHaveLength(6);

    // Once answered, its place is free again.
    await invoke("ai:answer", 1, { status: "done", label: "AI (Claude): Added Hero" });
    await first;
    void ai.ask(addHero);
    await invoke("ai:answer", 3, { status: "done", data: {} });
    await queries[0];
    void ai.ask(outline);
    expect(sent).toHaveLength(8);
  });
});
