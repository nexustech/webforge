import { COMPONENT } from "./puck-dom.js";

/**
 * Makes `node` a group if it is an element's wrapper that dnd-kit made a button, without the
 * `aria-pressed` only a button may have (dnd-kit sets it again as a drag starts or ends).
 */
function group(node: Node): void {
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return;
  }
  const element = node as Element;
  if (!element.matches(COMPONENT)) return;
  if (element.getAttribute("role") === "button") element.setAttribute("role", "group");
  if (element.getAttribute("role") === "group" && element.hasAttribute("aria-pressed")) {
    element.removeAttribute("aria-pressed");
  }
}

/** Makes the wrappers in what `node` added groups: an element placed already registered. */
function groupWithin(node: Node): void {
  group(node);
  if (node.nodeType === Node.ELEMENT_NODE) {
    for (const element of (node as Element).querySelectorAll(COMPONENT)) group(element);
  }
}

/**
 * Keeps each element's wrapper on the canvas in `document` a group, not a button (#465). dnd-kit
 * makes Puck's wrapper `role="button"` where it has no role of its own, which puts the element's
 * links, buttons and text inside a button: a control in a control, which assistive technology
 * can't reach (axe's `nested-interactive`). As a group it stays focusable and draggable, and dnd-kit
 * leaves a role it finds. Returns a function that stops.
 */
export function keepElementsGroups(document: Document): () => void {
  for (const element of document.querySelectorAll(COMPONENT)) group(element);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes") group(record.target);
      else for (const added of record.addedNodes) groupWithin(added);
    }
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["role", "aria-pressed"],
  });
  return () => observer.disconnect();
}
