import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerFailureLog } from "./failure-ipc.js";
import { setLogSink } from "./log.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

afterEach(() => {
  setLogSink();
  vi.restoreAllMocks();
});

function invoker() {
  const registered = new Map<string, Handler>();
  const ipc = {
    handle: (channel: string, handler: Handler) => registered.set(channel, handler),
  } as unknown as Pick<IpcMain, "handle">;
  registerFailureLog(ipc, () => true);
  return (...args: unknown[]) =>
    registered.get("app:log-failure")?.(
      { senderFrame: { url: "app" } } as IpcMainInvokeEvent,
      ...args,
    );
}

describe("registerFailureLog (R12)", () => {
  it("logs where a handled failure happened and its code", async () => {
    const lines: string[] = [];
    setLogSink((_level, line) => lines.push(line));
    const invoke = invoker();

    expect(await invoke("clipboard.paste", "Error ipc-failed")).toBeNull();

    expect(lines).toEqual([
      "The editor handled a failure (context=clipboard.paste, code=Error ipc-failed)",
    ]);
  });

  it("refuses anything but a plain context and code, so no message or path gets in", async () => {
    const lines: string[] = [];
    setLogSink((_level, line) => lines.push(line));
    const invoke = invoker();

    for (const [context, code] of [
      ["clipboard.paste", "EACCES: permission denied, open '/home/ana/x'"],
      ["/home/ana", "TypeError"],
      ["Clipboard paste", "TypeError"],
      ["clipboard.paste", "a b c"],
    ]) {
      await expect(invoke(context, code)).rejects.toThrow("ipc-failed");
    }
    expect(lines.join("\n")).not.toMatch(/home|EACCES:/);
  });
});
