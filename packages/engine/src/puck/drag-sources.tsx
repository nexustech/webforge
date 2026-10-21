import { Drawer } from "@puckeditor/core";
import { type ReactNode, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

/** An element outside the canvas that drags a new element of `componentType` onto it (1.13). */
type DragSource = {
  readonly element: HTMLElement;
  readonly componentType: string;
  /** Tells the portals apart across adds and removes. */
  readonly key: number;
};

/**
 * Puck's drawer item fills the element it is put in: Puck's own wrappers have no size of their own,
 * so every one of them takes the whole height. The handle is see-through, as the element shows
 * itself; while it is dragged, what follows the pointer is a chip with the element's name.
 */
const DRAG_SOURCE_CSS = `
.wf-drag-source { position: absolute; inset: 0; }
.wf-drag-source div { height: 100%; }
.wf-drag-source__handle { cursor: grab; }
.wf-drag-source__label { display: none; }
.wf-drag-source [data-dnd-dragging] .wf-drag-source__label {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  background: #0a6fb7;
  color: #ffffff;
  font: 500 12px/1.4 system-ui, sans-serif;
  white-space: nowrap;
}
`;

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
          <style>{DRAG_SOURCE_CSS}</style>
          <Drawer>
            <Drawer.Item name={componentType}>
              {() => (
                <div className="wf-drag-source__handle">
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
