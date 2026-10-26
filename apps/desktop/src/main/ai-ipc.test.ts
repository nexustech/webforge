import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiRequest } from "../shared/ipc/ai.js";
import { type AiWindow, registerAiHandlers } from "./ai-ipc.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

/** The bridge, its window's sent messages, and its handlers called as from a renderer. */
function bridge(options: { trusted?: boolean; window?: AiWindow | undefined } = {}) {
  const registered = new Map<string, Handler>();
  const ipc = {
    handle: (name: string, handler: Handler) => registered.set(name, handler),
  } as unknown as Pick<IpcMain, "handle">;
  const sent: unknown[][] = [];
  const crashed = { value: false };
  const window: AiWindow = {
    webContents: {
      send: (...args) => sent.push(args),
      isCrashed: () => crashed.value,
    },
  };
  const ai = registerAiHandlers(
    ipc,
    () => options.trusted ?? true,
    () => ("window" in options ? options.window : window),
    { queryMs: 1_000, commandMs: 2_000 },
  );
  const invoke = (channel: string, ...args: unknown[]) =>
    registered.get(channel)?.({ senderFrame: { url: "app" } } as IpcMainInvokeEvent, ...args);
  return { ai, sent, crashed, invoke };
}

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
    await invoke("ai:listening", true);
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
    await invoke("ai:listening", true);
    crashed.value = true;
    expect((await ai.ask(outline)).status).toBe("not-found");
    crashed.value = false;
    await invoke("ai:listening", false);
    expect((await ai.ask(outline)).status).toBe("not-found");
    expect(sent).toEqual([]);

    const closed = bridge({ window: undefined });
    await closed.invoke("ai:listening", true);
    expect((await closed.ai.ask(outline)).status).toBe("not-found");
  });

  it("gives up on a query sooner than on a command, which may wait for the person (D7)", async () => {
    vi.useFakeTimers();
    const { ai, invoke } = bridge();
    await invoke("ai:listening", true);
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

  it("refuses a renderer it does not trust, and answers outside the contract", async () => {
    const { invoke } = bridge({ trusted: false });
    await expect(invoke("ai:listening", true)).rejects.toThrow();
    const trusted = bridge();
    await expect(trusted.invoke("ai:answer", 1, { status: "maybe" })).rejects.toThrow();
  });
});
