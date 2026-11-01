import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiRequest } from "../shared/ipc/ai.js";
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
  const loads: ((details: { isMainFrame: boolean; isSameDocument: boolean }) => void)[] = [];
  const window: AiWindow = {
    webContents: {
      send: (...args) => sent.push(args),
      isCrashed: () => crashed.value,
      on: (_event, listener) => loads.push(listener),
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
    { queryMs: 1_000, commandMs: 2_000 },
  );
  /** The window starts loading a page: a reload, or only a part of the same one. */
  const load = (isSameDocument = false) => {
    for (const listener of loads) listener({ isMainFrame: true, isSameDocument });
  };
  const invoke = (channel: string, ...args: unknown[]) =>
    registered.get(channel)?.({ senderFrame: { url: "app" } } as IpcMainInvokeEvent, ...args);
  return { ai, sent, crashed, invoke, open, load, loads };
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

afterEach(() => {
  vi.useRealTimers();
});

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

  it("says no site is open until the renderer listens, and after it stops or crashes", async () => {
    const { ai, sent, crashed, invoke } = bridge();
    expect((await ai.ask(outline)).status).toBe("not-found");
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
    expect(await query).toMatchObject({ status: "not-found" });
    expect(await command).toMatchObject({ status: "not-found" });
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

  it("gives up on a query sooner than on a command, which may wait for the person (D7)", async () => {
    vi.useFakeTimers();
    const { ai, invoke } = bridge();
    await invoke("ai:listening", SESSION, true);
    const query = ai.ask(outline);
    const command = ai.ask(addHero);
    await vi.advanceTimersByTimeAsync(1_000);
    expect((await query).status).toBe("busy");
    await invoke("ai:answer", 2, { status: "declined", message: "No" });
    expect((await command).status).toBe("declined");

    const slow = ai.ask(addHero);
    await vi.advanceTimersByTimeAsync(2_000);
    expect((await slow).status).toBe("busy");
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
    expect(await ai.ask(addHero)).toMatchObject({ status: "busy" });
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
