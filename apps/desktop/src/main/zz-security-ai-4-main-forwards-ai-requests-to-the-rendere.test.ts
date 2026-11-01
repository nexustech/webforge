// Security review S21 (docs/reviews/2026-10-30-security-review.md), restored by #658.
import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { describe, expect, it } from "vitest";
import { AI_INPUT_MAX_CHARS, type AiRequest } from "../shared/ipc/ai.js";
import { type AiWindow, registerAiHandlers } from "./ai-ipc.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

const SESSION = "11111111-1111-4111-8111-111111111111";

function bridge() {
  const registered = new Map<string, Handler>();
  const ipc = {
    handle: (name: string, handler: Handler) => registered.set(name, handler),
  } as unknown as Pick<IpcMain, "handle">;
  const sent: unknown[][] = [];
  const window: AiWindow = {
    webContents: {
      send: (...args) => sent.push(args),
      isCrashed: () => false,
      on: () => undefined,
    },
  };
  const ai = registerAiHandlers(
    ipc,
    () => true,
    () => window,
    { staleReason: () => undefined },
    { queryMs: 60_000, commandMs: 60_000 },
  );
  const invoke = (channel: string, ...args: unknown[]) =>
    registered.get(channel)?.({ senderFrame: { url: "app" } } as IpcMainInvokeEvent, ...args);
  return { ai, sent, invoke };
}

describe("security: AiBridge.ask validates and bounds requests", () => {
  it("refuses a malformed request at once without forwarding it", async () => {
    const { ai, sent, invoke } = bridge();
    await invoke("ai:listening", SESSION, true);
    for (const malformed of [
      { kind: "command", name: "x y", input: {}, app: "" },
      { kind: "query", name: "outline", input: "x".repeat(AI_INPUT_MAX_CHARS) },
      { kind: "delete" },
    ]) {
      const result = await Promise.race([
        ai.ask(malformed),
        new Promise((resolve) => setTimeout(() => resolve("still-waiting"), 200)),
      ]);
      expect(result).toMatchObject({ status: "invalid" });
    }
    expect(sent).toEqual([]);
  });

  it("caps the number of requests waiting for the renderer", async () => {
    const { ai, sent, invoke } = bridge();
    await invoke("ai:listening", SESSION, true);
    const outline: AiRequest = { kind: "query", name: "outline", input: {} };
    const extra = [];
    for (let i = 0; i < 1_000; i++) extra.push(ai.ask(outline));
    // Without a cap, all 1000 go to the renderer and hold a timer each.
    expect(sent.length).toBeLessThan(1_000);
    expect(await extra.at(-1)).toMatchObject({ status: "busy" });
  });
});
