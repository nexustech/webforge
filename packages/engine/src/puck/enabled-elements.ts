import { COMPONENT } from "./puck-dom.js";

/** Puck's wrapper around each element on the canvas, which dnd-kit makes its draggable. */
const ELEMENT = COMPONENT;

/** Removes `aria-disabled` from `node` if it is an element's wrapper. */
function enable(node: Node): void {
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return;
  }
  const element = node as Element;
  if (element.matches(ELEMENT) && element.getAttribute("aria-disabled") === "true") {
    element.removeAttribute("aria-disabled");
  }
}

/**
 * Keeps the elements on the canvas in `document` from saying they are disabled while the layout is
 * locked (Content mode, 1.26). Puck turns dragging off then, and dnd-kit marks each element's
 * wrapper `aria-disabled="true"`: to assistive technology (and to tests) that disables everything
 * in it, the text that stays editable too. Only dragging is off, so the attribute goes again
 * whenever dnd-kit sets it. Returns a function that stops.
 */
export function keepElementsEnabled(document: Document): () => void {
  for (const element of document.querySelectorAll(ELEMENT)) enable(element);
  const observer = new MutationObserver((records) => {
    for (const record of records) enable(record.target);
  });
  observer.observe(document.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-disabled"],
  });
  return () => observer.disconnect();
}
