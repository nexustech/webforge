import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES } from "../shared/ipc/prefs.js";
import type { PreferencesStore } from "./preferences.js";
import { rememberWindowState, type StatefulWindow } from "./window-state.js";

/** A preferences `set` that saves, as the store's does. */
const savedSet = () => vi.fn<PreferencesStore["set"]>(async () => DEFAULT_PREFERENCES);

/** A window whose state the test sets, and whose events it fires. */
function fakeWindow() {
  const listeners = new Map<string, () => void>();
  const state = {
    destroyed: false,
    minimized: false,
    maximized: false,
    fullScreen: false,
    bounds: { x: 10.4, y: 20.6, width: 1280.2, height: 800 },
  };
  const window: StatefulWindow = {
    isDestroyed: () => state.destroyed,
    isMinimized: () => state.minimized,
    isMaximized: () => state.maximized,
    isFullScreen: () => state.fullScreen,
    getNormalBounds: () => state.bounds,
    on: (event, listener) => listeners.set(event, listener),
  };
  return { window, state, fire: (event: string) => listeners.get(event)?.() };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("rememberWindowState", () => {
  it("saves at once when the window is maximised or restored, with whole-pixel bounds", () => {
    const { window, state, fire } = fakeWindow();
    const set = savedSet();
    rememberWindowState(window, { set });

    state.maximized = true;
    fire("maximize");

    expect(set).toHaveBeenCalledWith({
      window: { maximized: true, bounds: { x: 10, y: 21, width: 1280, height: 800 } },
    });
  });

  it("counts full screen as maximised", () => {
    const { window, state, fire } = fakeWindow();
    const set = savedSet();
    rememberWindowState(window, { set });

    state.fullScreen = true;
    fire("enter-full-screen");

    expect(set).toHaveBeenLastCalledWith({ window: expect.objectContaining({ maximized: true }) });
  });

  it("saves moves and resizes once they stop, and a pending one when the window closes", () => {
    const { window, fire } = fakeWindow();
    const set = savedSet();
    rememberWindowState(window, { set });

    fire("moved");
    vi.advanceTimersByTime(400);
    fire("resized");
    vi.advanceTimersByTime(400);
    expect(set).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(set).toHaveBeenCalledTimes(1);

    fire("moved");
    fire("close");
    vi.advanceTimersByTime(500);
    expect(set).toHaveBeenCalledTimes(2);
  });

  it("saves nothing for a minimised or destroyed window", () => {
    const { window, state, fire } = fakeWindow();
    const set = savedSet();
    rememberWindowState(window, { set });

    state.minimized = true;
    fire("close");
    state.minimized = false;
    state.destroyed = true;
    fire("close");

    expect(set).not.toHaveBeenCalled();
  });

  it("logs a save that fails, by its code only", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { window, fire } = fakeWindow();
    rememberWindowState(window, {
      set: async () => {
        throw Object.assign(new Error("EACCES: C:\\Users\\sam\\prefs.json"), { code: "EACCES" });
      },
    });

    fire("close");
    await vi.runAllTimersAsync();

    expect(error).toHaveBeenCalledWith(
      "Webforge could not remember the window size (code=Error EACCES)",
    );
  });
});
