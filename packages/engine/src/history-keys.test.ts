// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { historyCommandFor, installHistoryKeys } from "./history-keys.js";

const key = (init: KeyboardEventInit) => ({
  key: "",
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...init,
});

describe("historyCommandFor", () => {
  it.each([
    [{ key: "z", ctrlKey: true }, "undo"],
    [{ key: "z", metaKey: true }, "undo"],
    [{ key: "Z", ctrlKey: true, shiftKey: true }, "redo"],
    [{ key: "Z", metaKey: true, shiftKey: true }, "redo"],
    [{ key: "y", ctrlKey: true }, "redo"],
    [{ key: "y", ctrlKey: true, shiftKey: true }, null],
    [{ key: "z" }, null],
    [{ key: "z", ctrlKey: true, altKey: true }, null],
    [{ key: "a", ctrlKey: true }, null],
    [{ key: "Escape" }, "cancel"],
    [{ key: "Escape", shiftKey: true }, null],
    [{ key: "Escape", ctrlKey: true }, null],
  ] as const)("maps %o to %s", (init, expected) => {
    expect(historyCommandFor(key(init))).toBe(expected);
  });
});

describe("installHistoryKeys", () => {
  it("takes undo and redo keys before anything else sees them", () => {
    const onCommand = vi.fn();
    const later = vi.fn();
    const remove = installHistoryKeys(window, onCommand);
    document.addEventListener("keydown", later);

    const event = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, cancelable: true });
    document.body.dispatchEvent(event);

    expect(onCommand).toHaveBeenCalledWith("undo");
    expect(event.defaultPrevented).toBe(true);
    expect(later).not.toHaveBeenCalled();
    remove();
    document.removeEventListener("keydown", later);
  });

  it("takes Esc only when it cancelled something", () => {
    const later = vi.fn();
    document.addEventListener("keydown", later);
    const press = (handled: boolean) => {
      const onCommand = vi.fn(() => handled);
      const remove = installHistoryKeys(window, onCommand);
      const event = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      });
      document.body.dispatchEvent(event);
      remove();
      expect(onCommand).toHaveBeenCalledWith("cancel");
      return event.defaultPrevented;
    };

    expect(press(true)).toBe(true);
    expect(later).not.toHaveBeenCalled();
    expect(press(false)).toBe(false);
    expect(later).toHaveBeenCalledOnce();
    document.removeEventListener("keydown", later);
  });

  it("lets other keys through", () => {
    const onCommand = vi.fn();
    const remove = installHistoryKeys(window, onCommand);

    const event = new KeyboardEvent("keydown", { key: "b", ctrlKey: true, cancelable: true });
    document.body.dispatchEvent(event);

    expect(onCommand).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    remove();
  });

  it("routes the browser's native undo and redo (Edit menu, contenteditable)", () => {
    const onCommand = vi.fn();
    const remove = installHistoryKeys(window, onCommand);

    for (const inputType of ["historyUndo", "historyRedo", "insertText"]) {
      document.body.dispatchEvent(new InputEvent("beforeinput", { inputType, cancelable: true }));
    }

    expect(onCommand.mock.calls).toEqual([["undo"], ["redo"]]);
    remove();
  });

  it("leaves the gestures it is told to ignore, as a dialog's text's own undo (#421 review)", () => {
    const onCommand = vi.fn();
    const field = document.createElement("input");
    document.body.append(field);
    const remove = installHistoryKeys(window, onCommand, {
      ignore: (event) => event.target === field,
    });

    const key = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, cancelable: true });
    field.dispatchEvent(key);
    field.dispatchEvent(new InputEvent("beforeinput", { inputType: "historyUndo" }));
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true }));

    expect(key.defaultPrevented).toBe(false);
    expect(onCommand.mock.calls).toEqual([["undo"]]);
    // Nothing after it saw the key (Puck's hotkeys would take it), but Esc goes on to the dialog.
    const after = vi.fn();
    window.addEventListener("keydown", after);
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }));
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    window.removeEventListener("keydown", after);
    expect(after.mock.calls.map(([event]) => event.key)).toEqual(["Escape"]);
    remove();
    field.remove();
  });

  it("stops listening when removed", () => {
    const onCommand = vi.fn();
    installHistoryKeys(window, onCommand)();

    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true }));
    document.body.dispatchEvent(new InputEvent("beforeinput", { inputType: "historyUndo" }));

    expect(onCommand).not.toHaveBeenCalled();
  });
});
