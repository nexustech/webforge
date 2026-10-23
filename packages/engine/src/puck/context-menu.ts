import type { CanvasContextMenu } from "../canvas-engine.js";

/** Editable text: where the browser's own menu has the spelling suggestions. */
const EDITABLE = '[contenteditable="true"], input, textarea';

type Closest = { closest?: (selector: string) => Element | null } | null;

/**
 * Reports right-clicks on the elements of the canvas document `document` (1.35), at their point in
 * the editor window: the canvas iframe is scaled by the canvas zoom, so its points are scaled and
 * moved by the iframe's place. The browser's own menu doesn't open over an element, except in text
 * that was being edited before the right-click, which keeps it (spelling suggestions, F-ED-24).
 * Returns a function that stops it.
 */
export function installContextMenu(
  document: Document,
  report: (menu: CanvasContextMenu) => void,
): () => void {
  // The text being edited when the button went down: pressing it moves the focus into what it's
  // on, so by the time the menu is asked for, any text under the pointer has it.
  let editing: Element | null = null;
  const pressed = () => {
    editing = (document.activeElement as Closest)?.closest?.(EDITABLE) ?? null;
  };
  const listener = (event: MouseEvent) => {
    const target = event.target as Closest;
    const text = target?.closest?.(EDITABLE);
    if (text != null && text === editing) {
      return;
    }
    const nodeId = target?.closest?.("[data-puck-component]")?.getAttribute("data-puck-component");
    if (nodeId === null || nodeId === undefined) {
      return;
    }
    event.preventDefault();
    // The iframe element belongs to the editor window, so `instanceof` against this realm fails.
    const frame = document.defaultView?.frameElement as HTMLElement | null | undefined;
    let { clientX: x, clientY: y } = event;
    if (frame !== null && frame !== undefined) {
      const box = frame.getBoundingClientRect();
      const scale = frame.offsetWidth > 0 ? box.width / frame.offsetWidth : 1;
      x = box.left + x * scale;
      y = box.top + y * scale;
    }
    report({ nodeId, x, y });
  };
  document.addEventListener("pointerdown", pressed, true);
  document.addEventListener("contextmenu", listener);
  return () => {
    document.removeEventListener("pointerdown", pressed, true);
    document.removeEventListener("contextmenu", listener);
  };
}
