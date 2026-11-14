// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { startGripDrag } from "./grip-drag.js";

/** A grip on the page, and a drag started on it with each of its callbacks watched. */
function dragging() {
  const grip = document.createElement("button");
  document.body.append(grip);
  const onMove = vi.fn();
  const onCommit = vi.fn();
  const onCancel = vi.fn();
  const cancel = startGripDrag({ grip, pointerId: 1, frame: window, onMove, onCommit, onCancel });
  const move = () => grip.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1 }));
  return { grip, onMove, onCommit, onCancel, cancel, move };
}

const escPressed = () =>
  new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });

afterEach(() => {
  document.body.replaceChildren();
});

describe("startGripDrag (#987)", () => {
  it("sends each move on, and commits once on letting go, after which nothing is heard", () => {
    const { grip, onMove, onCommit, onCancel, move } = dragging();

    move();
    move();
    grip.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
    move();
    grip.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
    window.dispatchEvent(escPressed());

    expect(onMove).toHaveBeenCalledTimes(2);
    expect(onCommit).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("cancels on Esc, with Shift held too, which nothing else sees", () => {
    const { onCommit, onCancel } = dragging();
    const elsewhere = vi.fn();
    window.addEventListener("keydown", elsewhere);
    const pressed = new KeyboardEvent("keydown", {
      key: "Escape",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    expect(onCancel).not.toHaveBeenCalled();
    window.dispatchEvent(pressed);

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onCommit).not.toHaveBeenCalled();
    expect(pressed.defaultPrevented).toBe(true);
    expect(elsewhere).toHaveBeenCalledOnce(); // the "a" only
    window.removeEventListener("keydown", elsewhere);
  });

  it("cancels when the browser does", () => {
    const { grip, onCancel, onCommit } = dragging();

    grip.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 1 }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("cancels once from what it returns, for a grip that goes mid-drag, leaving no listeners", () => {
    const { grip, onMove, onCancel, onCommit, cancel, move } = dragging();
    const removed = vi.spyOn(window, "removeEventListener");

    cancel();
    cancel();
    move();
    grip.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
    window.dispatchEvent(escPressed());

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onMove).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
    expect(removed).toHaveBeenCalledWith("keydown", expect.any(Function), true);
    removed.mockRestore();
  });

  it("holds the pointer for the drag, and lets it go at the end", () => {
    const grip = document.createElement("button");
    document.body.append(grip);
    const captured = new Set<number>();
    grip.setPointerCapture = (id: number) => captured.add(id);
    grip.hasPointerCapture = (id: number) => captured.has(id);
    grip.releasePointerCapture = (id: number) => captured.delete(id);

    startGripDrag({
      grip,
      pointerId: 7,
      frame: window,
      onMove: () => undefined,
      onCommit: () => undefined,
      onCancel: () => undefined,
    });
    expect(captured.has(7)).toBe(true);
    grip.dispatchEvent(new PointerEvent("pointerup", { pointerId: 7 }));

    expect(captured.size).toBe(0);
  });
});
