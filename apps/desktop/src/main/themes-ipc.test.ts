import { DEFAULT_THEME } from "@webforge/model";
import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { describe, expect, it, vi } from "vitest";
import type { MyThemes } from "./my-themes.js";
import { registerThemesHandlers } from "./themes-ipc.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

/** My themes as a fake that records what it's asked. */
function fakeThemes(): MyThemes {
  return {
    list: vi.fn(() => Promise.resolve([])),
    keep: vi.fn(() => Promise.resolve("kept" as const)),
    remove: vi.fn(() => Promise.resolve()),
    idle: vi.fn(() => Promise.resolve()),
  };
}

/** The handler of `channel`, called as from a renderer that `trusted` says it trusts or not. */
function invoker(themes: MyThemes, channel: string, trusted = true) {
  const registered = new Map<string, Handler>();
  const ipc = {
    handle: (name: string, handler: Handler) => registered.set(name, handler),
  } as unknown as Pick<IpcMain, "handle">;
  registerThemesHandlers(ipc, () => trusted, themes);
  return (...args: unknown[]) =>
    registered.get(channel)?.({ senderFrame: { url: "app" } } as IpcMainInvokeEvent, ...args);
}

const mine = { ...DEFAULT_THEME, own: { id: "theme0000000000a", name: "Bakery" } };

describe("registerThemesHandlers (2.23)", () => {
  it("lists, keeps and removes the person's own themes", async () => {
    const themes = fakeThemes();
    expect(await invoker(themes, "themes:list")()).toEqual([]);
    expect(await invoker(themes, "themes:keep")(mine)).toBe("kept");
    expect(themes.keep).toHaveBeenCalledWith(mine);
    expect(await invoker(themes, "themes:remove")("theme0000000000a")).toBeNull();
    expect(themes.remove).toHaveBeenCalledWith("theme0000000000a");
  });

  it("refuses a built-in theme, a theme that isn't one, and an untrusted renderer", async () => {
    const themes = fakeThemes();
    await expect(invoker(themes, "themes:keep")(DEFAULT_THEME)).rejects.toThrow();
    await expect(invoker(themes, "themes:keep")({ ...mine, scheme: "sepia" })).rejects.toThrow();
    await expect(invoker(themes, "themes:remove")("../escape")).rejects.toThrow();
    await expect(invoker(themes, "themes:list", false)()).rejects.toThrow();
    expect(themes.keep).not.toHaveBeenCalled();
    expect(themes.remove).not.toHaveBeenCalled();
  });
});
