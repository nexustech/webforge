import { COMPONENT, COMPONENT_ATTRIBUTE, componentSelector } from "./puck-dom.js";

/** The chrome's outline over an element, named by the element's id (see `createSelectionOutline`). */
const OUTLINE = ".wf-outline[data-wf-id]";

/** The id of the element whose outline `node` is in, if it's in one. */
function outlineOf(node: EventTarget | null): string | null {
  // The canvas's nodes are the iframe's, so `instanceof` against the editor's realm fails.
  const element = node as Partial<Element> | null;
  return element?.closest?.(OUTLINE)?.getAttribute("data-wf-id") ?? null;
}

/**
 * The wrapper whose element Puck takes the pointer to be over at `node`: the nearest one around it.
 * A `mouseout` from inside it bubbles to Puck's listener on it, as one from the wrapper itself does.
 */
function wrapperOf(node: EventTarget | null): Element | null {
  const element = node as Partial<Element> | null;
  return element?.closest?.(COMPONENT) ?? null;
}

/**
 * Keeps an element hovered while the pointer is on its own outline's controls (#1129), in the
 * window `target`: the + on a hovered section's bottom edge, which adds a section after it.
 *
 * Puck hovers an element on `mouseover` of its wrapper, ends that on `mouseout`, and draws the
 * element's outline only while it's hovered or selected. The outline is in Puck's overlay, outside
 * the wrapper, so moving onto the + took the pointer out of the wrapper: the hover ended and the +
 * went with it, before it could be clicked or show its tooltip.
 *
 * Before Puck's listener sees it, this stops the `mouseout` that takes the pointer from an element
 * (its wrapper, or anything in it) onto that element's outline. Leaving the outline for somewhere
 * outside the element then sends the wrapper the `mouseout` Puck would have had, which ends the
 * hover as before. Back into the element, nothing is sent: it stays hovered, with no hover ended
 * and started again. `puck-dom.test.tsx` checks this against Puck. Returns what stops it.
 */
export function keepHoverOnOutline(target: Window): () => void {
  const onMouseOut = (event: MouseEvent) => {
    const outlined = outlineOf(event.target);
    if (outlined === null) {
      const from = wrapperOf(event.target)?.getAttribute(COMPONENT_ATTRIBUTE) ?? null;
      if (from !== null && outlineOf(event.relatedTarget) === from) event.stopPropagation();
      return;
    }
    if (outlineOf(event.relatedTarget) === outlined) return;
    const doc = (event.target as Partial<Element>).ownerDocument;
    const wrapper = doc?.querySelector(componentSelector(outlined)) ?? null;
    const view = doc?.defaultView ?? null;
    // Into an element inside this one ends its hover, as Puck's own listener does.
    if (wrapper === null || view === null || wrapperOf(event.relatedTarget) === wrapper) return;
    wrapper.dispatchEvent(
      new view.MouseEvent("mouseout", {
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
  target.addEventListener("mouseout", onMouseOut, { capture: true });
  return () => target.removeEventListener("mouseout", onMouseOut, { capture: true });
}
