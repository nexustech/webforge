import { fireEvent } from "@testing-library/react";

/** The keys held through a drag, from before the press (#271). */
type Keys = {
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly shiftKey?: boolean;
};

/** Where on the row under the pointer a drag is: happy-dom lays nothing out, so rows have no height. */
type Place = "before" | "after";

/**
 * Presses on row `from` and moves over row `to` (as `useRowDrag` follows a drag, with pointer
 * events), picking `from` up. With no layout, a pointer level with a row's top is before it and
 * one below it after it. Returns what lets it go there, and what puts it back (Escape).
 */
export function pickUp(from: Element, to: Element, keys: Keys = {}, place: Place = "before") {
  const at = { pointerId: 1, clientX: 10, clientY: place === "before" ? 0 : 10, ...keys };
  fireEvent.pointerDown(from, { pointerId: 1, button: 0, clientX: 0, clientY: 0, ...keys });
  fireEvent.pointerMove(to, at);
  return {
    /** Moves on over row `over`. */
    over: (over: Element) => fireEvent.pointerMove(over, at),
    /** Lets go over row `over`, `to` unless given. */
    drop: (over: Element = to) => fireEvent.pointerUp(over, at),
    /** Puts the row back. */
    cancel: () => fireEvent.keyDown(window, { key: "Escape" }),
  };
}

/** Drags row `from` onto row `to`, and lets go there. */
export function dragRow(from: Element, to: Element, keys: Keys = {}, place: Place = "before") {
  pickUp(from, to, keys, place).drop();
}
