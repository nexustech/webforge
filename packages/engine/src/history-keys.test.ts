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

  it("stops listening when removed", () => {
    const onCommand = vi.fn();
    installHistoryKeys(window, onCommand)();

    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true }));
    document.body.dispatchEvent(new InputEvent("beforeinput", { inputType: "historyUndo" }));

    expect(onCommand).not.toHaveBeenCalled();
  });
});
