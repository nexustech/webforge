import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { describe, expect, it, vi } from "vitest";
import { registerHelpHandlers } from "./help-ipc.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

const EDITOR = "file:///app/renderer/index.html";
const HELP = "file:///app/renderer/help.html";

/** The help handlers, with the windows' pages told apart as main tells them apart. */
function handlers(openExternal = vi.fn(async (_url: string) => undefined)) {
  const registered = new Map<string, Handler>();
  const ipc = {
    handle: (name: string, handler: Handler) => registered.set(name, handler),
  } as unknown as Pick<IpcMain, "handle">;
  const help = { open: vi.fn(), isHelpPage: (url: string) => url === HELP };
  registerHelpHandlers(ipc, (url) => url === EDITOR, help, openExternal);
  const invoke = (channel: string, from: string, ...args: unknown[]) =>
    registered.get(channel)?.({ senderFrame: { url: from } } as IpcMainInvokeEvent, ...args);
  return { invoke, help, openExternal };
}

describe("registerHelpHandlers (5.4b)", () => {
  it("opens Help at a page and heading for the editor's window only", async () => {
    const { invoke, help } = handlers();
    expect(await invoke("help:open", EDITOR, { page: "site-check", anchor: "tips" })).toBe(true);
    expect(help.open).toHaveBeenCalledWith({ page: "site-check", anchor: "tips" });

    await expect(invoke("help:open", HELP, { page: "export" })).rejects.toThrow();
    await expect(invoke("help:open", EDITOR, { page: "../secrets" })).rejects.toThrow();
    expect(help.open).toHaveBeenCalledOnce();
  });

  it("opens a page on the web for the Help window only, and never another kind of address", async () => {
    const { invoke, openExternal } = handlers();
    expect(await invoke("help:open-external", HELP, "https://www.example.org/help")).toBe(true);
    expect(openExternal).toHaveBeenCalledWith("https://www.example.org/help");

    await expect(
      invoke("help:open-external", EDITOR, "https://www.example.org/"),
    ).rejects.toThrow();
    await expect(invoke("help:open-external", HELP, "file:///etc/passwd")).rejects.toThrow();
    await expect(invoke("help:open-external", HELP, "javascript:alert(1)")).rejects.toThrow();
    expect(openExternal).toHaveBeenCalledOnce();
  });

  it("says when the browser couldn't open it", async () => {
    const { invoke } = handlers(vi.fn(async () => Promise.reject(new Error("no browser"))));
    expect(await invoke("help:open-external", HELP, "https://www.example.org/")).toBe(false);
  });
});
