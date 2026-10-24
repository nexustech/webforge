// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { timeKeystrokes, typingPauses } from "./typing-pauses.js";

describe("typingPauses (#307)", () => {
  it("has no pause to tell until a key is pressed", () => {
    expect(typingPauses().take()).toBeUndefined();
  });

  it("counts the time before the very first keystroke as a pause", () => {
    const pauses = typingPauses();
    pauses.keystroke(1_000);
    pauses.keystroke(1_050);

    expect(pauses.take()).toBe(Number.POSITIVE_INFINITY);
  });

  it("tells the longest pause since it was last asked, from the keystroke before", () => {
    const pauses = typingPauses();
    pauses.keystroke(0);
    pauses.take();
    pauses.keystroke(80);
    pauses.keystroke(1_500);
    pauses.keystroke(1_560);

    expect(pauses.take()).toBe(1_420);
    // Asked again with no keys pressed since: nothing to tell.
    expect(pauses.take()).toBeUndefined();
    pauses.keystroke(1_600);
    expect(pauses.take()).toBe(40);
  });

  it("ignores a clock that went back (another page in the canvas)", () => {
    const pauses = typingPauses();
    pauses.keystroke(5_000);
    pauses.take();
    pauses.keystroke(10);

    expect(pauses.take()).toBe(0);
  });

  /** `timeKeystrokes` on a window of its own, and a way to press keys in it at a given time. */
  const keyboard = () => {
    const pauses = typingPauses();
    const target = new EventTarget() as Window;
    Object.defineProperty(target, "performance", { value: { timeOrigin: 1_000 } });
    const press = (timeStamp: number, key = "a", init: KeyboardEventInit = {}) => {
      const event = new KeyboardEvent("keydown", { key, ...init });
      Object.defineProperty(event, "timeStamp", { value: timeStamp });
      target.dispatchEvent(event);
    };
    return { pauses, press, stop: timeKeystrokes(target, pauses) };
  };

  it("times keys by when they were pressed, until it is stopped", () => {
    const { pauses, press, stop } = keyboard();

    press(100);
    pauses.take();
    press(1_300);
    expect(pauses.take()).toBe(1_200);
    stop();
    press(5_000);
    expect(pauses.take()).toBeUndefined();
  });

  it("times only the keys that type: characters, AltGr's, Backspace, Delete and Enter", () => {
    const { pauses, press } = keyboard();
    const typed = (key: string, init: KeyboardEventInit = {}) => {
      pauses.take();
      press(100, key, init);
      return pauses.take() !== undefined;
    };

    for (const key of ["a", "I", " ", ".", "é", "😀", "Backspace", "Delete", "Enter"]) {
      expect(typed(key), key).toBe(true);
    }
    expect(typed("€", { ctrlKey: true, altKey: true })).toBe(true);
    // Moving the caret, modifier keys and shortcuts don't type.
    for (const key of ["ArrowLeft", "Shift", "Control", "Tab", "Escape", "Home"]) {
      expect(typed(key), key).toBe(false);
    }
    expect(typed("z", { ctrlKey: true })).toBe(false);
    expect(typed("v", { metaKey: true })).toBe(false);
  });
});
