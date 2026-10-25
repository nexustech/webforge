import { afterEach, describe, expect, it, vi } from "vitest";
import { AppLifecycle, closeThenExit } from "./app-lifecycle.js";

/** A window that records how it was brought forward. */
function fakeWindow(minimized = false) {
  const calls: string[] = [];
  return {
    calls,
    isMinimized: () => minimized,
    restore: () => calls.push("restore"),
    show: () => calls.push("show"),
    focus: () => calls.push("focus"),
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("AppLifecycle", () => {
  it("gives the app's one window, and none when it has none", () => {
    const window = fakeWindow();
    const windows: ReturnType<typeof fakeWindow>[] = [];
    const lifecycle = new AppLifecycle(() => windows);

    expect(lifecycle.mainWindow()).toBeUndefined();
    expect(lifecycle.focusMainWindow()).toBeUndefined();
    windows.push(window);
    expect(lifecycle.mainWindow()).toBe(window);
  });

  it("brings the window forward, restoring it if it was minimised", () => {
    const shown = fakeWindow();
    const minimised = fakeWindow(true);

    new AppLifecycle(() => [shown]).focusMainWindow();
    new AppLifecycle(() => [minimised]).focusMainWindow();

    expect(shown.calls).toEqual(["show", "focus"]);
    expect(minimised.calls).toEqual(["restore", "show", "focus"]);
  });

  it("starts with nothing quitting, handed over or read", () => {
    const lifecycle = new AppLifecycle(() => []);

    expect(lifecycle).toMatchObject({ quitting: false, exiting: false });
    expect(lifecycle.projectFromFinder).toBeUndefined();
    expect(lifecycle.preferences).toBeUndefined();
    expect(lifecycle.flushOnClose).toBeUndefined();
  });
});

describe("closeThenExit", () => {
  it("closes the site, then releases the lock, then exits", async () => {
    const order: string[] = [];

    await closeThenExit({
      close: async () => {
        order.push("close");
      },
      releaseLock: () => order.push("release"),
      exit: (code) => order.push(`exit ${code}`),
    });

    expect(order).toEqual(["close", "release", "exit 0"]);
  });

  it("exits even when closing fails, logging it by its code", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const exit = vi.fn();

    await closeThenExit({
      close: async () => {
        throw Object.assign(new Error("EBUSY: C:\\Sites\\Bakery.wforge"), { code: "EBUSY" });
      },
      releaseLock: () => undefined,
      exit,
    });

    expect(exit).toHaveBeenCalledWith(0);
    expect(error).toHaveBeenCalledWith("Webforge could not close the site (code=Error EBUSY)");
  });

  it("exits after 10 s when closing never finishes", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const exit = vi.fn();

    const exiting = closeThenExit({
      close: () => new Promise(() => undefined),
      releaseLock: () => undefined,
      exit,
    });
    await vi.advanceTimersByTimeAsync(9_999);
    expect(exit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await exiting;

    expect(exit).toHaveBeenCalledWith(0);
  });
});
