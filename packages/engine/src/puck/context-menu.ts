import type { CanvasContextMenu } from "../canvas-engine.js";
import { COMPONENT, COMPONENT_ATTRIBUTE, componentSelector } from "./puck-dom.js";

/** Editable text: where the browser's own menu has the spelling suggestions. */
const EDITABLE = '[contenteditable="true"], input, textarea';

/** How soon after the right button goes down its menu is asked for. Later ones are the keyboard's. */
const POINTER_MENU_MS = 1000;

type Closest = { closest?: (selector: string) => Element | null } | null;

/** What decides whether, and for which element, the canvas shows the element menu. */
export type ContextMenuOptions = {
  /** Whether the element menu opens at all: not in Content mode, where the browser's does. */
  readonly enabled: () => boolean;
  /** The selected element, which the keyboard's menu key opens the menu for. */
  readonly selected: () => string | null;
};

/**
 * Reports requests for the element menu on the canvas document `document` (1.35), at their point
 * in the editor window: the canvas iframe is scaled by the canvas zoom, so its points are scaled
 * and moved by the iframe's place.
 * - A right-click asks for the menu of the element under the pointer.
 * - Shift+F10 or the menu key asks for the selected element's, under it.
 * - Text being edited keeps the browser's own menu (spelling suggestions, F-ED-24): text that had
 *   the focus before a right-click, or has it when the keyboard asks.
 * - The browser's menu opens instead where there is no element, and whenever `enabled` says no.
 *
 * Returns a function that stops it.
 */
export function installContextMenu(
  document: Document,
  report: (menu: CanvasContextMenu) => void,
  options: ContextMenuOptions,
): () => void {
  const editableIn = (element: Element | null) => (element as Closest)?.closest?.(EDITABLE) ?? null;
  // The last right button press, and the text being edited before it: pressing the button moves
  // the focus into what it's on, so by the time the menu is asked for, text under it has it.
  let pressed: { readonly at: number; readonly editing: Element | null } | null = null;
  const onPointerDown = (event: PointerEvent) => {
    if (event.button === 2) {
      pressed = { at: event.timeStamp, editing: editableIn(document.activeElement) };
    }
  };

  /** `x`, `y` in the canvas document as a point in the editor window. */
  const inEditor = (x: number, y: number) => {
    // The iframe element belongs to the editor window, so `instanceof` against this realm fails.
    const frame = document.defaultView?.frameElement as HTMLElement | null | undefined;
    if (frame === null || frame === undefined) return { x, y };
    const box = frame.getBoundingClientRect();
    const scale = frame.offsetWidth > 0 ? box.width / frame.offsetWidth : 1;
    return { x: box.left + x * scale, y: box.top + y * scale };
  };

  const onContextMenu = (event: MouseEvent) => {
    const press = pressed;
    pressed = null;
    if (!options.enabled()) {
      return;
    }
    const fromPointer = press !== null && event.timeStamp - press.at < POINTER_MENU_MS;
    if (!fromPointer) {
      // The keyboard's: the selected element's menu, unless text is being edited.
      const nodeId = options.selected();
      if (editableIn(document.activeElement) !== null || nodeId === null) return;
      const wrapper = document.querySelector(componentSelector(nodeId));
      // Puck wraps each element in a `div` of its own: the element is its child.
      const box = (wrapper?.firstElementChild ?? wrapper)?.getBoundingClientRect();
      if (box === undefined) return;
      event.preventDefault();
      report({ nodeId, ...inEditor(box.left + 16, box.bottom) });
      return;
    }
    const target = event.target as Closest;
    const text = target?.closest?.(EDITABLE);
    if (text != null && text === press.editing) {
      return;
    }
    const nodeId = target?.closest?.(COMPONENT)?.getAttribute(COMPONENT_ATTRIBUTE);
    if (nodeId === null || nodeId === undefined) {
      return;
    }
    event.preventDefault();
    report({ nodeId, ...inEditor(event.clientX, event.clientY) });
  };
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("contextmenu", onContextMenu);
  return () => {
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("contextmenu", onContextMenu);
  };
}
