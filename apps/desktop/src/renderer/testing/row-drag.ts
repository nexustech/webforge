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
 * events, the button held), picking `from` up. happy-dom lays nothing out: the row under the
 * pointer is the one the pointer is said to be over, and a pointer level with a row's top is
 * before it, one below it after it. Returns what moves on, lets go and puts the row back.
 */
export function pickUp(from: Element, to: Element, keys: Keys = {}, place: Place = "before") {
  const at = { pointerId: 1, clientX: 10, clientY: place === "before" ? 0 : 10, ...keys };
  const over = (element: Element) => {
    document.elementFromPoint = () => element;
  };
  fireEvent.pointerDown(from, {
    pointerId: 1,
    button: 0,
    buttons: 1,
    clientX: 0,
    clientY: 0,
    ...keys,
  });
  over(to);
  fireEvent.pointerMove(to, { ...at, buttons: 1 });
  return {
    /** Moves on over row `element`. */
    over: (element: Element) => {
      over(element);
      fireEvent.pointerMove(element, { ...at, buttons: 1 });
    },
    /** Lets go over row `element`, `to` unless given. */
    drop: (element: Element = to) => {
      over(element);
      fireEvent.pointerUp(element, { ...at, buttons: 0 });
    },
    /** Puts the row back. */
    cancel: () => fireEvent.keyDown(window, { key: "Escape" }),
  };
}

/** Drags row `from` onto row `to`, and lets go there. */
export function dragRow(from: Element, to: Element, keys: Keys = {}, place: Place = "before") {
  pickUp(from, to, keys, place).drop();
}
