import { COMPONENT, INLINE_TEXT, RICH_TEXT } from "./puck-dom.js";

/** Puck's text on the canvas that keeps `mouseover` from the element around it. */
const TEXT = `${INLINE_TEXT}, ${RICH_TEXT}`;

/**
 * Hovers an element when the pointer is over its text (#399, SP-1), in the window `target`. Puck
 * registers its inline text fields and rich-text editors as overlay portals, which stop `mouseover`
 * as it comes down to them (capture phase). The element's wrapper, whose own `mouseover` listener
 * hovers it, then never gets one: no hover outline or name chip over an element's text, and none
 * at all on a Text element, which its editor fills. Before the event gets that far, this sends a
 * `mouseover` of its own to the nearest wrapper, which Puck's listener takes as the pointer being
 * over that element, and stops there. `mouseout` isn't stopped, so moving on from the text still
 * ends the hover. `puck-dom.test.tsx` checks this against Puck, so an upgrade that changes either
 * side fails there. Returns what stops it.
 */
export function hoverElementsOverText(target: Window): () => void {
  const onMouseOver = (event: MouseEvent) => {
    // The canvas's elements are the iframe's, so `instanceof` against the editor's realm fails.
    const over = event.target as Partial<Element> | null;
    const wrapper = over?.closest?.(TEXT)?.closest(COMPONENT) ?? null;
    const view = wrapper?.ownerDocument.defaultView ?? null;
    if (wrapper === null || view === null) return;
    wrapper.dispatchEvent(
      new view.MouseEvent("mouseover", {
        bubbles: true,
        cancelable: true,
        view,
        relatedTarget: event.relatedTarget,
        clientX: event.clientX,
        clientY: event.clientY,
        screenX: event.screenX,
        screenY: event.screenY,
      }),
    );
  };
  target.addEventListener("mouseover", onMouseOver, { capture: true });
  return () => target.removeEventListener("mouseover", onMouseOver, { capture: true });
}
