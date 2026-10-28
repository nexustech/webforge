import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { describe, expect, it, vi } from "vitest";
import { GUIDE_ADDRESSES, registerGuideHandlers } from "./guides.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

function invoker(openExternal: (url: string) => Promise<void>) {
  const registered = new Map<string, Handler>();
  const ipc = {
    handle: (channel: string, handler: Handler) => registered.set(channel, handler),
  } as unknown as Pick<IpcMain, "handle">;
  registerGuideHandlers(ipc, () => true, openExternal);
  return (...args: unknown[]) =>
    registered.get("app:open-guide")?.(
      { senderFrame: { url: "app" } } as IpcMainInvokeEvent,
      ...args,
    );
}

describe("registerGuideHandlers (3.17)", () => {
  it("opens each guide's own page, on Google's https site", async () => {
    const openExternal = vi.fn(async () => undefined);
    const invoke = invoker(openExternal);

    expect(await invoke("businessProfile")).toBe(true);
    expect(await invoke("searchConsole")).toBe(true);

    expect(openExternal.mock.calls).toEqual([
      [GUIDE_ADDRESSES.businessProfile],
      [GUIDE_ADDRESSES.searchConsole],
    ]);
    for (const address of Object.values(GUIDE_ADDRESSES)) {
      expect(new URL(address).protocol).toBe("https:");
      expect(new URL(address).hostname).toMatch(/(^|\.)google\.com$/);
    }
  });

  it("opens nothing but a guide: an address from the renderer is refused", async () => {
    const openExternal = vi.fn(async () => undefined);
    const invoke = invoker(openExternal);

    await expect(invoke("https://example.com")).rejects.toThrow("ipc-failed");
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("answers false when the browser couldn't be opened", async () => {
    const invoke = invoker(async () => {
      throw new Error("no browser");
    });

    expect(await invoke("searchConsole")).toBe(false);
  });
});
