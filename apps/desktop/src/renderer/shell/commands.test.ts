// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createCommandRegistry,
  formatShortcut,
  installCommandShortcuts,
  isMac,
  matchesShortcut,
  onKeyboard,
} from "./commands.js";
import type { StandardShortcut } from "./shortcut-standard.js";

/** A registry whose commands take their keys from `shortcuts` instead of the app's standard. */
const withKeys = (shortcuts: Record<string, Omit<StandardShortcut, "group">>, mac?: boolean) =>
  createCommandRegistry({
    shortcuts: Object.fromEntries(
      Object.entries(shortcuts).map(([id, entry]) => [id, { group: "edit", ...entry }]),
    ),
    ...(mac === undefined ? {} : { mac }),
  });

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

  it("runs nothing while paused, until every pause is resumed", () => {
    const registry = createCommandRegistry();
    const run = vi.fn();
    registry.register({ id: "a", label: "A", run });

    const resumeFirst = registry.pause();
    const resumeSecond = registry.pause();
    expect(registry.run("a")).toBe(false);
    resumeFirst();
    resumeFirst();
    expect(registry.run("a")).toBe(false);
    resumeSecond();

    expect(registry.run("a")).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("gives a command its keys from the standard, showing the first the keyboard has", () => {
    const shortcuts = {
      delete: { keys: ["Delete", "Mod+Backspace"], text: true as const },
      box: { keys: ["Mod+P", "Mod+K"], text: ["Mod+K"] },
    };
    const windows = withKeys(shortcuts, false);
    const mac = withKeys(shortcuts, true);
    for (const registry of [windows, mac]) {
      registry.register({ id: "delete", label: "Delete", run: vi.fn() });
      registry.register({ id: "box", label: "Box", run: vi.fn() });
      registry.register({ id: "plain", label: "No keys", run: vi.fn() });
    }

    expect(windows.get("delete")).toMatchObject({
      shortcut: "Delete",
      extraShortcuts: ["Mod+Backspace"],
      textKeys: ["Delete", "Mod+Backspace"],
    });
    // A Mac keyboard has no Delete key.
    expect(mac.get("delete")).toMatchObject({
      shortcut: "Mod+Backspace",
      extraShortcuts: ["Delete"],
    });
    expect(windows.get("box")).toMatchObject({
      shortcut: "Mod+P",
      extraShortcuts: ["Mod+K"],
      textKeys: ["Mod+K"],
    });
    expect(windows.get("plain")).toEqual({
      id: "plain",
      label: "No keys",
      run: expect.any(Function),
    });
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

  it("matches a letter with Option on a Mac by the key's place, as Option changes the character", () => {
    // ⌘⌥B types ∫ on a Mac keyboard.
    expect(
      matchesShortcut(
        key({ key: "∫", code: "KeyB", metaKey: true, altKey: true }),
        "Mod+Alt+B",
        true,
      ),
    ).toBe(true);
    expect(
      matchesShortcut(
        key({ key: "∫", code: "KeyB", metaKey: true, altKey: true }),
        "Mod+Alt+C",
        true,
      ),
    ).toBe(false);
    // Without Alt the character decides, so other layouts keep their letters.
    expect(matchesShortcut(key({ key: "z", code: "KeyY", ctrlKey: true }), "Mod+Z", false)).toBe(
      true,
    );
    expect(matchesShortcut(key({ key: "z", code: "KeyY", ctrlKey: true }), "Mod+Y", false)).toBe(
      false,
    );
  });

  it("matches symbols and digits with whatever Shift the keyboard layout needs", () => {
    // `?` is Shift+/ on a US keyboard; Ctrl+Shift+= or the keypad's + make `+`.
    expect(matchesShortcut(key({ key: "?", shiftKey: true }), "?", false)).toBe(true);
    expect(matchesShortcut(key({ key: "?" }), "?", false)).toBe(true);
    expect(
      matchesShortcut(key({ key: "+", ctrlKey: true, shiftKey: true }), "Mod+Plus", false),
    ).toBe(true);
    // AZERTY's 0 needs Shift.
    expect(matchesShortcut(key({ key: "0", ctrlKey: true, shiftKey: true }), "Mod+0", false)).toBe(
      true,
    );
    // Letters still tell Shift apart.
    expect(matchesShortcut(key({ key: "V", ctrlKey: true, shiftKey: true }), "Mod+V", false)).toBe(
      false,
    );
    expect(matchesShortcut(key({ key: "/", ctrlKey: true }), "?", false)).toBe(false);
  });

  it("formats shortcuts for each platform", () => {
    expect(formatShortcut("Mod+Shift+Z", false)).toBe("Ctrl+Shift+Z");
    expect(formatShortcut("Mod+Shift+Z", true)).toBe("⇧⌘Z");
    expect(formatShortcut("Alt+Mod+k", true)).toBe("⌥⌘K");
    expect(formatShortcut("Mod+Delete", false)).toBe("Ctrl+Delete");
    expect(formatShortcut("Mod+Backspace", true)).toBe("⌘⌫");
    expect(formatShortcut("Mod+Alt+ArrowUp", false)).toBe("Ctrl+Alt+↑");
    expect(formatShortcut("Mod+Alt+ArrowUp", true)).toBe("⌥⌘↑");
    expect(formatShortcut("Mod+-", false)).toBe("Ctrl+−");
    expect(formatShortcut("Mod+Plus", false)).toBe("Ctrl++");
    expect(formatShortcut("Escape", false)).toBe("Esc");
    expect(formatShortcut("Enter", true)).toBe("↩");
    expect(formatShortcut("?", false)).toBe("?");
    expect(formatShortcut("Shift+Space", false)).toBe("Shift+Space");
    expect(formatShortcut("Shift+Space", true)).toBe("⇧Space");
    expect(matchesShortcut(key({ key: " ", shiftKey: true }), "Shift+Space", false)).toBe(true);
  });

  it("knows a Mac keyboard has no Delete key", () => {
    expect(onKeyboard("Delete", true)).toBe(false);
    expect(onKeyboard("Delete", false)).toBe(true);
    expect(onKeyboard("Mod+Backspace", true)).toBe(true);
  });

  it("knows macOS by its platform name", () => {
    expect(isMac("MacIntel")).toBe(true);
    expect(isMac("Win32")).toBe(false);
  });

  describe("installCommandShortcuts", () => {
    let remove: () => void = () => {};
    afterEach(() => remove());

    it("runs the command whose shortcut was pressed, once", () => {
      const registry = withKeys({ box: { keys: ["Mod+K"] } });
      const run = vi.fn();
      registry.register({ id: "box", label: "Box", run });
      remove = installCommandShortcuts(window, registry);
      const ctrl = !isMac();

      const event = key({ key: "k", ctrlKey: ctrl, metaKey: !ctrl });
      window.dispatchEvent(event);

      expect(run).toHaveBeenCalledOnce();
      expect(event.defaultPrevented).toBe(true);
    });

    it("runs a command from its extra shortcuts too", () => {
      const registry = withKeys({ palette: { keys: ["Mod+P", "Mod+K"] } });
      const run = vi.fn();
      registry.register({ id: "palette", label: "Palette", run });
      remove = installCommandShortcuts(window, registry);
      const ctrl = !isMac();

      window.dispatchEvent(key({ key: "p", ctrlKey: ctrl, metaKey: !ctrl }));
      window.dispatchEvent(key({ key: "k", ctrlKey: ctrl, metaKey: !ctrl }));

      expect(run).toHaveBeenCalledTimes(2);
    });

    it("leaves keys alone that were handled already, repeat or match no command", () => {
      const registry = withKeys({ box: { keys: ["Mod+K"] } });
      const run = vi.fn();
      registry.register({ id: "box", label: "Box", run });
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

    it("leaves text shortcuts (Copy) to a text field or selected text", () => {
      const registry = withKeys({ copy: { keys: ["Mod+C"], text: true } });
      const run = vi.fn();
      registry.register({ id: "copy", label: "Copy", run });
      remove = installCommandShortcuts(window, registry);
      const ctrl = !isMac();
      const copy = () => key({ key: "c", ctrlKey: ctrl, metaKey: !ctrl, bubbles: true });

      const input = document.createElement("input");
      const paragraph = document.createElement("p");
      paragraph.textContent = "Opening times";
      document.body.append(input, paragraph);
      try {
        input.dispatchEvent(copy());
        window.getSelection()?.selectAllChildren(paragraph);
        window.dispatchEvent(copy());
        expect(run).not.toHaveBeenCalled();

        window.getSelection()?.removeAllRanges();
        const event = copy();
        window.dispatchEvent(event);
        expect(run).toHaveBeenCalledOnce();
        expect(event.defaultPrevented).toBe(true);
        // A checkbox has no text to copy: the command runs.
        input.type = "checkbox";
        input.dispatchEvent(copy());
        expect(run).toHaveBeenCalledTimes(2);
      } finally {
        input.remove();
        paragraph.remove();
      }
    });

    it("leaves Delete and Mod+Backspace to text being edited, rich text too (1.30)", () => {
      const registry = withKeys({ delete: { keys: ["Delete", "Mod+Backspace"], text: true } });
      const run = vi.fn();
      registry.register({ id: "delete", label: "Delete", run });
      remove = installCommandShortcuts(window, registry);
      const ctrl = !isMac();
      const modBackspace = () =>
        key({ key: "Backspace", ctrlKey: ctrl, metaKey: !ctrl, bubbles: true });
      // The rich-text editor's element, and the element selected on the canvas.
      const text = document.createElement("div");
      text.setAttribute("contenteditable", "true");
      const selected = document.createElement("div");
      document.body.append(text, selected);
      try {
        text.dispatchEvent(key({ key: "Delete", bubbles: true }));
        text.dispatchEvent(key({ key: "Backspace", bubbles: true }));
        // Deletes a word there.
        text.dispatchEvent(modBackspace());
        expect(run).not.toHaveBeenCalled();

        selected.dispatchEvent(modBackspace());
        selected.dispatchEvent(key({ key: "Delete", bubbles: true }));
        expect(run).toHaveBeenCalledTimes(2);
      } finally {
        text.remove();
        selected.remove();
      }
    });

    it("leaves only a command's text keys to text: Mod+K makes a link there, Mod+P still opens", () => {
      const registry = withKeys({ box: { keys: ["Mod+P", "Mod+K"], text: ["Mod+K"] } });
      const run = vi.fn();
      registry.register({ id: "box", label: "Box", run });
      remove = installCommandShortcuts(window, registry);
      const ctrl = !isMac();
      const text = document.createElement("div");
      text.setAttribute("contenteditable", "true");
      document.body.append(text);
      try {
        text.dispatchEvent(key({ key: "k", ctrlKey: ctrl, metaKey: !ctrl, bubbles: true }));
        expect(run).not.toHaveBeenCalled();
        text.dispatchEvent(key({ key: "p", ctrlKey: ctrl, metaKey: !ctrl, bubbles: true }));
        expect(run).toHaveBeenCalledOnce();
      } finally {
        text.remove();
      }
    });

    it("runs no command, Mod keys included, from inside an open dialog", () => {
      const registry = withKeys({ duplicate: { keys: ["Mod+D"] } });
      const run = vi.fn();
      registry.register({ id: "duplicate", label: "Duplicate", run });
      remove = installCommandShortcuts(window, registry);
      const ctrl = !isMac();
      const dialog = document.createElement("div");
      dialog.setAttribute("role", "dialog");
      const inDialog = document.createElement("p");
      dialog.append(inDialog);
      document.body.append(dialog);
      try {
        inDialog.dispatchEvent(key({ key: "d", ctrlKey: ctrl, metaKey: !ctrl, bubbles: true }));
        expect(run).not.toHaveBeenCalled();
        document.body.dispatchEvent(
          key({ key: "d", ctrlKey: ctrl, metaKey: !ctrl, bubbles: true }),
        );
        expect(run).toHaveBeenCalledOnce();
      } finally {
        dialog.remove();
      }
    });

    it("leaves plain-key shortcuts to a focused field, list or editable text", () => {
      const registry = withKeys({ delete: { keys: ["Delete"] }, box: { keys: ["Mod+K"] } });
      const remove_ = vi.fn();
      const box = vi.fn();
      registry.register({ id: "delete", label: "Delete", run: remove_ });
      registry.register({ id: "box", label: "Box", run: box });
      remove = installCommandShortcuts(window, registry);
      const field = document.createElement("input");
      document.body.append(field);
      const ctrl = !isMac();

      const list = document.createElement("div");
      list.setAttribute("role", "listbox");
      const plain = document.createElement("div");
      const dialog = document.createElement("div");
      dialog.setAttribute("role", "dialog");
      const inDialog = document.createElement("p");
      dialog.append(inDialog);
      document.body.append(dialog);
      // dnd-kit's draggable items are role="button" but take arrows only while dragged.
      const draggable = document.createElement("div");
      draggable.setAttribute("role", "button");
      draggable.setAttribute("aria-roledescription", "draggable");
      document.body.append(list, plain, draggable);

      field.dispatchEvent(key({ key: "Delete", bubbles: true }));
      list.dispatchEvent(key({ key: "Delete", bubbles: true }));
      field.dispatchEvent(key({ key: "k", ctrlKey: ctrl, metaKey: !ctrl, bubbles: true }));
      document.body.dispatchEvent(key({ key: "Delete", bubbles: true }));
      // A focused element that is only selectable, such as the canvas's selected element.
      plain.dispatchEvent(key({ key: "Delete", bubbles: true }));
      draggable.dispatchEvent(key({ key: "Delete", bubbles: true }));
      inDialog.dispatchEvent(key({ key: "Delete", bubbles: true }));

      expect(box).toHaveBeenCalledOnce();
      expect(remove_).toHaveBeenCalledTimes(3);
      field.remove();
      list.remove();
      plain.remove();
      draggable.remove();
      dialog.remove();
    });
  });
});
