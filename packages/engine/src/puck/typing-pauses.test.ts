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

  it("times keys by when they were pressed, until it is stopped", () => {
    const pauses = typingPauses();
    const target = new EventTarget() as Window;
    Object.defineProperty(target, "performance", { value: { timeOrigin: 1_000 } });
    const press = (timeStamp: number) => {
      const event = new Event("keydown");
      Object.defineProperty(event, "timeStamp", { value: timeStamp });
      target.dispatchEvent(event);
    };
    const stop = timeKeystrokes(target, pauses);

    press(100);
    pauses.take();
    press(1_300);
    expect(pauses.take()).toBe(1_200);
    stop();
    press(5_000);
    expect(pauses.take()).toBeUndefined();
  });
});
