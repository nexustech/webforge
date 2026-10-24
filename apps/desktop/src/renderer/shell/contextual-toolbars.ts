import type { ComponentType } from "react";

/**
 * The contextual toolbars (SP-4): what the canvas toolbar's centre shows for the selected element,
 * such as a Heading's level or a List's *Add item*. Each area registers its elements' toolbars with
 * {@link ContextualToolbarRegistry.register} instead of editing the canvas toolbar.
 */

/** One element's toolbar. */
export type ContextualToolbar = {
  /** Unique (`headingLevel`). */
  readonly id: string;
  /** The element types it is shown for (`Heading`). */
  readonly types: readonly string[];
  /** Its controls for the selected element `nodeId`; it reads and changes the element itself. */
  readonly component: ComponentType<{ readonly nodeId: string }>;
};

/** The registry; one per window. */
export type ContextualToolbarRegistry = {
  /** Adds a toolbar and returns a function that removes it. Ids must be unique. */
  register(toolbar: ContextualToolbar): () => void;
  /** The toolbar for elements of `type`, the first registered if several are; none if no toolbar is. */
  forType(type: string): ContextualToolbar | undefined;
  /** The registered toolbars, in registration order. Stable until something changes. */
  list(): readonly ContextualToolbar[];
  subscribe(listener: () => void): () => void;
};

/** Creates an empty registry. */
export function createContextualToolbars(): ContextualToolbarRegistry {
  const toolbars = new Map<string, ContextualToolbar>();
  const listeners = new Set<() => void>();
  let snapshot: readonly ContextualToolbar[] = [];

  const changed = () => {
    snapshot = [...toolbars.values()];
    for (const listener of listeners) listener();
  };

  return {
    register(toolbar) {
      if (toolbars.has(toolbar.id)) {
        throw new Error(`Toolbar "${toolbar.id}" is already registered`);
      }
      toolbars.set(toolbar.id, toolbar);
      changed();
      return () => {
        if (toolbars.get(toolbar.id) === toolbar) {
          toolbars.delete(toolbar.id);
          changed();
        }
      };
    },
    forType: (type) => snapshot.find((toolbar) => toolbar.types.includes(type)),
    list: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
