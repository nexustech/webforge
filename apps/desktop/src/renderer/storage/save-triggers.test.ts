import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  const focus = { inApp: false };
  const uninstall = installSaveTriggers(
    target as unknown as Window,
    autosave,
    ui,
    (save) => {
      flushRequest = save;
      return stopFlushRequests;
    },
    () => focus.inApp,
  );
  const blur = async () => {
    target.dispatchEvent(new Event("blur"));
    await vi.advanceTimersByTimeAsync(0);
  };
  return {
    flush,
    ui,
    blur,
    focus,
    uninstall,
    stopFlushRequests,
    flushRequest: () => flushRequest,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("installSaveTriggers", () => {
  it("saves when the app loses focus", async () => {
    const { blur, flush } = setUp();

    await blur();

    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("doesn't save when focus only moves into the canvas", async () => {
    const { blur, focus, flush } = setUp();
    focus.inApp = true;

    await blur();

    expect(flush).not.toHaveBeenCalled();
  });

  it("saves when another page is shown, not on other UI changes", () => {
    const { ui, flush } = setUp();

    ui.setState({ pageId: "home" });
    ui.setState({ pageId: "about" });

    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("answers the main process's save requests (close, Ctrl/Cmd+S) with a save", async () => {
    const { flush, flushRequest } = setUp();

    await flushRequest()?.();

    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("removes every trigger, including a blur check still pending", async () => {
    const { ui, blur, flush, uninstall, stopFlushRequests } = setUp();
    await blur();
    flush.mockClear();

    uninstall();
    await blur();
    ui.setState({ pageId: "about" });

    expect(flush).not.toHaveBeenCalled();
    expect(stopFlushRequests).toHaveBeenCalled();
  });
});
