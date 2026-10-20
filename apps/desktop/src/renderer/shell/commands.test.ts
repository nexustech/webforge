// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createCommandRegistry,
  formatShortcut,
  installCommandShortcuts,
  isMac,
  matchesShortcut,
} from "./commands.js";

describe("createCommandRegistry", () => {
  it("registers, lists and runs commands", () => {
    const registry = createCommandRegistry();
    const run = vi.fn();
    registry.register({ id: "a", label: "A", run });
    registry.register({ id: "b", label: "B", run: vi.fn() });

    expect(registry.list().map((command) => command.id)).toEqual(["a", "b"]);
    expect(registry.run("a")).toBe(true);
    expect(run).toHaveBeenCalledOnce();
    expect(registry.run("missing")).toBe(false);
  });

  it("refuses a second command with the same id", () => {
    const registry = createCommandRegistry();
    registry.register({ id: "a", label: "A", run: vi.fn() });

    expect(() => registry.register({ id: "a", label: "Again", run: vi.fn() })).toThrow(/already/);
  });

  it("doesn't run a disabled command, and enables it on update", () => {
    const registry = createCommandRegistry();
    const run = vi.fn();
    registry.register({ id: "undo", label: "Undo", enabled: false, run });

    expect(registry.run("undo")).toBe(false);
    registry.update("undo", { enabled: true });
    expect(registry.run("undo")).toBe(true);
    expect(run).toHaveBeenCalledOnce();
  });

  it("tells subscribers about changes and keeps the list stable otherwise", () => {
    const registry = createCommandRegistry();
    const listener = vi.fn();
    const stop = registry.subscribe(listener);
    const remove = registry.register({ id: "a", label: "A", run: vi.fn() });
    const before = registry.list();

    registry.update("a", { label: "A" });
    registry.update("missing", { enabled: false });
    expect(registry.list()).toBe(before);
    expect(listener).toHaveBeenCalledTimes(1);

    registry.update("a", { label: "Renamed" });
    remove();
    expect(listener).toHaveBeenCalledTimes(3);
    expect(registry.list()).toEqual([]);

    stop();
    registry.register({ id: "b", label: "B", run: vi.fn() });
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("ignores a stale unregister after the id was registered again", () => {
    const registry = createCommandRegistry();
    const removeFirst = registry.register({ id: "a", label: "First", run: vi.fn() });
    removeFirst();
    registry.register({ id: "a", label: "Second", run: vi.fn() });

    removeFirst();

    expect(registry.get("a")?.label).toBe("Second");
  });

  it("reports a failed asynchronous command without throwing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const registry = createCommandRegistry();
    registry.register({ id: "a", label: "A", run: () => Promise.reject(new Error("boom")) });

    expect(registry.run("a")).toBe(true);
    await vi.waitFor(() =>
      expect(error).toHaveBeenCalledWith('Command "a" failed', expect.any(Error)),
    );
    error.mockRestore();
  });
});

describe("shortcuts", () => {
  const key = (init: KeyboardEventInit) =>
    new KeyboardEvent("keydown", { ...init, cancelable: true });

  it("matches Mod as Ctrl on Windows and Cmd on macOS", () => {
    expect(matchesShortcut(key({ key: "k", ctrlKey: true }), "Mod+K", false)).toBe(true);
    expect(matchesShortcut(key({ key: "k", metaKey: true }), "Mod+K", false)).toBe(false);
    expect(matchesShortcut(key({ key: "k", metaKey: true }), "Mod+K", true)).toBe(true);
    expect(matchesShortcut(key({ key: "K", ctrlKey: true, shiftKey: true }), "Mod+K", false)).toBe(
      false,
    );
    expect(
      matchesShortcut(key({ key: "Z", ctrlKey: true, shiftKey: true }), "Mod+Shift+Z", false),
    ).toBe(true);
  });

  it("formats shortcuts for each platform", () => {
    expect(formatShortcut("Mod+Shift+Z", false)).toBe("Ctrl+Shift+Z");
    expect(formatShortcut("Mod+Shift+Z", true)).toBe("⇧⌘Z");
    expect(formatShortcut("Alt+Mod+k", true)).toBe("⌥⌘K");
    expect(formatShortcut("Mod+Delete", false)).toBe("Ctrl+Delete");
  });

  it("knows macOS by its platform name", () => {
    expect(isMac("MacIntel")).toBe(true);
    expect(isMac("Win32")).toBe(false);
  });

  describe("installCommandShortcuts", () => {
    let remove: () => void = () => {};
    afterEach(() => remove());

    it("runs the command whose shortcut was pressed, once", () => {
      const registry = createCommandRegistry();
      const run = vi.fn();
      registry.register({ id: "box", label: "Box", shortcut: "Mod+K", run });
      remove = installCommandShortcuts(window, registry);
      const ctrl = !isMac();

      const event = key({ key: "k", ctrlKey: ctrl, metaKey: !ctrl });
      window.dispatchEvent(event);

      expect(run).toHaveBeenCalledOnce();
      expect(event.defaultPrevented).toBe(true);
    });

    it("leaves keys alone that were handled already, repeat or match no command", () => {
      const registry = createCommandRegistry();
      const run = vi.fn();
      registry.register({ id: "box", label: "Box", shortcut: "Mod+K", run });
      remove = installCommandShortcuts(window, registry);
      const ctrl = !isMac();

      const handled = key({ key: "k", ctrlKey: ctrl, metaKey: !ctrl });
      handled.preventDefault();
      window.dispatchEvent(handled);
      window.dispatchEvent(key({ key: "k", ctrlKey: ctrl, metaKey: !ctrl, repeat: true }));
      const other = key({ key: "j", ctrlKey: ctrl, metaKey: !ctrl });
      window.dispatchEvent(other);

      expect(run).not.toHaveBeenCalled();
      expect(other.defaultPrevented).toBe(false);
    });
  });
});
