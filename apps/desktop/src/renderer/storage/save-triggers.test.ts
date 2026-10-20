// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { createStore } from "zustand/vanilla";
import type { Autosave } from "./autosave.js";
import { installSaveTriggers } from "./save-triggers.js";

function setUp() {
  const target = new EventTarget();
  const flush = vi.fn(async () => undefined);
  const autosave = { flush } as unknown as Autosave;
  const ui = createStore<{ pageId: string }>()(() => ({ pageId: "home" }));
  let flushRequest: (() => Promise<void>) | undefined;
  const stopFlushRequests = vi.fn();
  const uninstall = installSaveTriggers(target as unknown as Window, autosave, ui, (save) => {
    flushRequest = save;
    return stopFlushRequests;
  });
  const key = (init: KeyboardEventInit) => {
    const event = new KeyboardEvent("keydown", { cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
  };
  return { target, flush, ui, key, uninstall, stopFlushRequests, flushRequest: () => flushRequest };
}

describe("installSaveTriggers", () => {
  it("saves when the window loses focus", () => {
    const { target, flush } = setUp();

    target.dispatchEvent(new Event("blur"));

    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("saves now on Ctrl+S and Cmd+S, and keeps the browser's own save from opening", () => {
    const { key, flush } = setUp();

    const ctrl = key({ key: "s", ctrlKey: true });
    const cmd = key({ key: "S", metaKey: true });
    key({ key: "s" });
    key({ key: "s", ctrlKey: true, altKey: true });
    key({ key: "s", ctrlKey: true, shiftKey: true });

    expect(flush).toHaveBeenCalledTimes(2);
    expect(ctrl.defaultPrevented).toBe(true);
    expect(cmd.defaultPrevented).toBe(true);
  });

  it("saves when another page is shown, not on other UI changes", () => {
    const { ui, flush } = setUp();

    ui.setState({ pageId: "home" });
    ui.setState({ pageId: "about" });

    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("answers the main process's flush request with a save", async () => {
    const { flush, flushRequest } = setUp();

    await flushRequest()?.();

    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("removes every trigger", () => {
    const { target, ui, key, flush, uninstall, stopFlushRequests } = setUp();

    uninstall();
    target.dispatchEvent(new Event("blur"));
    key({ key: "s", ctrlKey: true });
    ui.setState({ pageId: "about" });

    expect(flush).not.toHaveBeenCalled();
    expect(stopFlushRequests).toHaveBeenCalled();
  });
});
