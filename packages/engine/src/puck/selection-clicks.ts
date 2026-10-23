import type { Unsubscribe } from "../canvas-engine.js";

/** Marks the stylesheet that outlines the other selected elements (see {@link showAlsoSelected}). */
const ALSO_SELECTED_STYLE = "data-webforge-also-selected";

/**
 * Follows clicks in `target` (the editor window, or the canvas iframe's) that add to the selection
 * or take from it (1.31, UX-3): with Ctrl, Cmd or Shift held, on an element of the page, not on
 * the selected element's bar or in text being edited (where Shift-click extends the text). For
 * one, `adding` is called with the element's id before Puck selects it, so the change Puck then
 * reports is an addition; a plain click calls it with `null`. Returns a function that stops.
 */
export function watchAddingClicks(
  target: Window,
  adding: (id: string | null) => void,
): Unsubscribe {
  // What had the focus as the pointer went down, before the press itself moved it.
  let focusedAtPress: Element | null = null;
  /** The element an adding click or press is on, if it is one (see above). */
  const addingTo = (event: MouseEvent): string | undefined => {
    if (!(event.ctrlKey || event.metaKey || event.shiftKey)) return undefined;
    // The canvas iframe's elements aren't this window's `Element`: duck-typed.
    const clicked = event.target as Partial<Element> | null;
    if (typeof clicked?.closest !== "function") return undefined;
    if (clicked.closest("[data-puck-overlay]") !== null) return undefined;
    const editable = clicked.closest("[contenteditable]");
    if (editable !== null && focusedAtPress !== null && editable.contains(focusedAtPress)) {
      return undefined;
    }
    const id = clicked.closest("[data-puck-component]")?.getAttribute("data-puck-component");
    return typeof id === "string" ? id : undefined;
  };
  const onPointerDown = () => {
    focusedAtPress = target.document.activeElement;
  };
  // Adding an element puts no caret in its text: the press doesn't move the focus.
  const onMouseDown = (event: MouseEvent) => {
    if (addingTo(event) !== undefined) event.preventDefault();
  };
  const onClick = (event: MouseEvent) => adding(addingTo(event) ?? null);
  // A key ends what a click started: the arrows select from the keyboard.
  const onKey = () => adding(null);
  const listeners = [
    ["pointerdown", onPointerDown],
    ["mousedown", onMouseDown],
    ["click", onClick],
    ["keydown", onKey],
  ] as const;
  for (const [type, listener] of listeners) {
    target.addEventListener(type, listener as EventListener, { capture: true });
  }
  return () => {
    for (const [type, listener] of listeners) {
      target.removeEventListener(type, listener as EventListener, { capture: true });
    }
  };
}

/**
 * Outlines elements `ids` in `doc` as the selected one is, while several are selected (1.31). A
 * stylesheet rather than marks on the elements, so they stay through Puck's re-renders.
 */
export function showAlsoSelected(doc: Document, ids: readonly string[]): void {
  let style = doc.head.querySelector(`style[${ALSO_SELECTED_STYLE}]`);
  if (style === null) {
    style = doc.createElement("style");
    style.setAttribute(ALSO_SELECTED_STYLE, "");
    doc.head.append(style);
  }
  style.textContent = ids
    .map(
      (id) =>
        `[data-puck-component="${CSS.escape(id)}"] {\n` +
        "  outline: calc(2px / var(--wf-zoom, 1)) solid #f028f3;\n" +
        "  outline-offset: calc(-2px / var(--wf-zoom, 1));\n}",
    )
    .join("\n");
}
