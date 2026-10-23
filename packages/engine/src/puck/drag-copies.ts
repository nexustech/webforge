import { isNodeDoc, type NodeDoc, type PageDoc } from "@webforge/model";
import type { Unsubscribe } from "../canvas-engine.js";
import { findNode, ROOT_ZONE } from "./tree.js";

/**
 * The keys held during a drag on the canvas (1.30, UX-4): Ctrl or Cmd copies what is dragged
 * instead of moving it; with Shift too, a linked copy of a shared section places another linked
 * copy (F-ED-23). Ctrl and Cmd both count, as the engine doesn't know the platform.
 */
export type DragKeys = { copy: boolean; linked: boolean; pressed: boolean };

/**
 * Follows {@link DragKeys} in `target` (the editor window, or the canvas iframe's) while the
 * pointer is down: from its events, which carry the keys, and from the keys themselves, so pressing
 * Ctrl in the middle of a drag counts too. They are kept as they were when the pointer went up:
 * Puck drops after a short animation, by which time Ctrl may be let go. Returns a function that
 * stops.
 */
export function trackDragKeys(target: Window, keys: DragKeys): Unsubscribe {
  const follow = (event: PointerEvent | KeyboardEvent) => {
    keys.copy = event.ctrlKey || event.metaKey;
    keys.linked = keys.copy && event.shiftKey;
  };
  const listeners = {
    pointerdown: (event: PointerEvent) => {
      keys.pressed = true;
      follow(event);
    },
    pointermove: (event: PointerEvent) => keys.pressed && follow(event),
    pointerup: (event: PointerEvent) => {
      if (keys.pressed) follow(event);
      keys.pressed = false;
    },
    keydown: (event: KeyboardEvent) => keys.pressed && follow(event),
    keyup: (event: KeyboardEvent) => keys.pressed && follow(event),
  };
  for (const [type, listener] of Object.entries(listeners)) {
    target.addEventListener(type, listener as EventListener, { capture: true });
  }
  return () => {
    for (const [type, listener] of Object.entries(listeners)) {
      target.removeEventListener(type, listener as EventListener, { capture: true });
    }
  };
}

/**
 * The keys held for the drop just made, and none from now on: each drop takes them once, so a
 * later drag that doesn't start with the pointer (from the keyboard) can't inherit a Ctrl.
 */
export function takeDragKeys(keys: DragKeys): { readonly copy: boolean; readonly linked: boolean } {
  const held = { copy: keys.copy, linked: keys.linked };
  keys.copy = false;
  keys.linked = false;
  return held;
}

/** A Puck drag that moved an element: where from and where to, as Puck's `move` says. */
export type Drop = {
  readonly sourceZone: string;
  readonly sourceIndex: number;
  readonly destinationZone: string;
  readonly destinationIndex: number;
};

/**
 * Where a copy of the dragged element goes in `destinationZone` of the page as it was before the
 * drag. Puck counts a drop in the element's own list without the element; the original stays, so
 * a drop after it is one further on.
 */
export function copyIndex(drop: Drop): number {
  return drop.sourceZone === drop.destinationZone && drop.sourceIndex < drop.destinationIndex
    ? drop.destinationIndex + 1
    : drop.destinationIndex;
}

/** `page` with `node` at `index` of Puck's zone `zone` (`<parentId>:<slot>`); unchanged if no zone. */
export function insertedAt(page: PageDoc, zone: string, index: number, node: NodeDoc): PageDoc {
  const insert = (list: readonly NodeDoc[]) => [
    ...list.slice(0, index),
    node,
    ...list.slice(index),
  ];
  if (zone === ROOT_ZONE) {
    return { ...page, content: insert(page.content) };
  }
  const separator = zone.lastIndexOf(":");
  const parentId = zone.slice(0, separator);
  const slot = zone.slice(separator + 1);
  if (findNode(page, parentId) === undefined) {
    return page;
  }
  // Only the nodes on the way to the parent are new; the rest stay as they were.
  const visit = (list: readonly NodeDoc[]): readonly NodeDoc[] => {
    let changed = false;
    const next = list.map((each) => {
      const props = { ...each.props } as Record<string, unknown>;
      let inside = false;
      for (const [key, value] of Object.entries(each.props)) {
        if (!Array.isArray(value) || !value.every(isNodeDoc)) continue;
        const nodes = value as readonly NodeDoc[];
        const updated = each.props.id === parentId && key === slot ? insert(nodes) : visit(nodes);
        if (updated !== nodes) {
          props[key] = updated;
          inside = true;
        }
      }
      if (!inside) return each;
      changed = true;
      return { ...each, props: props as NodeDoc["props"] };
    });
    return changed ? next : list;
  };
  return { ...page, content: [...visit(page.content)] };
}
