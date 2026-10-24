import { Drawer } from "@puckeditor/core";
import { type ReactNode, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { DRAWER_ITEM } from "./puck-dom.js";

/** An element outside the canvas that drags a new element of `componentType` onto it (1.13). */
type DragSource = {
  readonly element: HTMLElement;
  readonly componentType: string;
  /** Tells the portals apart across adds and removes. */
  readonly key: number;
};

/** Marks the one copy of {@link DRAG_SOURCE_CSS} in a document. */
const STYLE_ATTRIBUTE = "data-webforge-drag-sources";

/**
 * Puck's drawer item fills the element it is put in: Puck's own wrappers have no size of their own,
 * so every one of them takes the whole height. The press lands on Puck's drawer item itself, not on
 * the handle inside it: dnd-kit won't start a drag from inside a button (the app's own) unless the
 * press is on its draggable element. The handle is see-through, as the element shows itself; while
 * it is dragged, what follows the pointer is a chip with the element's name, in the editor's colours.
 */
const DRAG_SOURCE_CSS = `
.wf-drag-source { position: absolute; inset: 0; }
.wf-drag-source div { height: 100%; }
.wf-drag-source ${DRAWER_ITEM} { cursor: grab; }
.wf-drag-source__handle { pointer-events: none; }
.wf-drag-source__label { display: none; }
.wf-drag-source [data-dnd-dragging] .wf-drag-source__label {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  background: var(--primary, #0a6fb7);
  color: var(--primary-foreground, #ffffff);
  font: 500 12px/1.4 system-ui, sans-serif;
  white-space: nowrap;
}
`;

/** Adds {@link DRAG_SOURCE_CSS} to `document` once. */
function applyDragSourceStyles(document: Document): void {
  if (document.head.querySelector(`style[${STYLE_ATTRIBUTE}]`) === null) {
    const style = document.createElement("style");
    style.setAttribute(STYLE_ATTRIBUTE, "");
    style.textContent = DRAG_SOURCE_CSS;
    document.head.append(style);
  }
}

/**
 * Keeps Puck's drag handle out of the keyboard and screen readers: it sits inside the app's own
 * control (an Add panel button), which already adds on click and Enter, so dragging is a pointer
 * extra. dnd-kit makes its handle a focusable `role="button"` only where it has no `tabindex` and
 * `role` of its own, and this runs first: a child's ref is set before its parent's.
 */
function hideHandle(handle: HTMLElement | null): void {
  const item = handle?.closest(DRAWER_ITEM);
  if (item) {
    item.setAttribute("tabindex", "-1");
    item.setAttribute("role", "presentation");
    item.setAttribute("aria-hidden", "true");
  }
}

/** The drag sources registered with {@link createDragSources}, and the Puck part that shows them. */
export type DragSources = {
  /** Makes `element` drag a new `componentType` onto the canvas until the returned call. */
  add(element: HTMLElement, componentType: string): () => void;
  /** Renders a Puck drawer item into every registered element; must be inside `<Puck>`. */
  readonly Portals: () => ReactNode;
};

/**
 * Drag sources for the app's Add panel (1.13, F-ED-1): each one is a Puck drawer item, portalled
 * into the app's own element from inside Puck's tree, so it uses Puck's drag and drop with its
 * drop indicators and valid drop targets, and a drop is one Puck insert like any other.
 */
export function createDragSources(labelOf: (componentType: string) => string): DragSources {
  let sources: readonly DragSource[] = [];
  let nextKey = 0;
  const listeners = new Set<() => void>();
  const changed = () => {
    for (const listener of listeners) listener();
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const current = () => sources;

  function Portals() {
    const shown = useSyncExternalStore(subscribe, current, current);
    return shown.map(({ element, componentType, key }) =>
      createPortal(
        <div className="wf-drag-source">
          <Drawer>
            <Drawer.Item name={componentType}>
              {() => (
                <div className="wf-drag-source__handle" ref={hideHandle}>
                  <span className="wf-drag-source__label">{labelOf(componentType)}</span>
                </div>
              )}
            </Drawer.Item>
          </Drawer>
        </div>,
        element,
        String(key),
      ),
    );
  }

  return {
    add(element, componentType) {
      applyDragSourceStyles(element.ownerDocument);
      const source = { element, componentType, key: nextKey++ };
      sources = [...sources, source];
      changed();
      return () => {
        sources = sources.filter((other) => other !== source);
        changed();
      };
    },
    Portals,
  };
}
