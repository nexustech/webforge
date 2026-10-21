import type { ComponentType } from "react";

/**
 * The panel registry: each area puts its panels in the window layout (UI1) with
 * {@link PanelRegistry.register} instead of editing the shell. Panels sharing a slot become tabs.
 */

/** Where a panel goes: the left and right columns' top and bottom, or the bottom drawer. */
export type PanelSlot = "left.top" | "left.bottom" | "right.top" | "right.bottom" | "drawer";

/** One panel. `title` is already translated (`t()`) and labels its tab. */
export type Panel = {
  /** Unique (`undoHistory`, `pages`). */
  readonly id: string;
  readonly slot: PanelSlot;
  readonly title: string;
  /** Shown only in Advanced mode (T2): Layers, Custom Code. */
  readonly advancedOnly?: boolean;
  /** Tab order within the slot, lowest first; ties keep registration order. */
  readonly order?: number;
  readonly component: ComponentType;
};

/** The registry; one per window. */
export type PanelRegistry = {
  /** Adds a panel and returns a function that removes it. Ids must be unique. */
  register(panel: Panel): () => void;
  /** The registered panels, in registration order. Stable until something changes. */
  list(): readonly Panel[];
  subscribe(listener: () => void): () => void;
  /** Brings the panel `id` to the front of its column, opening the column if it is collapsed. */
  show(id: string): void;
  /** Calls `listener` with the id of each panel {@link show} asks for. */
  onShow(listener: (id: string) => void): () => void;
};

/** Creates an empty registry. */
export function createPanelRegistry(): PanelRegistry {
  const panels = new Map<string, Panel>();
  const listeners = new Set<() => void>();
  const showListeners = new Set<(id: string) => void>();
  let snapshot: readonly Panel[] = [];

  const changed = () => {
    snapshot = [...panels.values()];
    for (const listener of listeners) listener();
  };

  return {
    register(panel) {
      if (panels.has(panel.id)) {
        throw new Error(`Panel "${panel.id}" is already registered`);
      }
      panels.set(panel.id, panel);
      changed();
      return () => {
        if (panels.get(panel.id) === panel) {
          panels.delete(panel.id);
          changed();
        }
      };
    },
    list: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    show(id) {
      for (const listener of showListeners) listener(id);
    },
    onShow(listener) {
      showListeners.add(listener);
      return () => {
        showListeners.delete(listener);
      };
    },
  };
}

/** The panels to show in `slot`, in tab order; Advanced-only panels need Advanced mode. */
export function panelsInSlot(
  panels: readonly Panel[],
  slot: PanelSlot,
  editorLevel: "simple" | "advanced",
): Panel[] {
  return panels
    .filter((panel) => panel.slot === slot && (editorLevel === "advanced" || !panel.advancedOnly))
    .map((panel, index) => ({ panel, index }))
    .toSorted((a, b) => (a.panel.order ?? 0) - (b.panel.order ?? 0) || a.index - b.index)
    .map(({ panel }) => panel);
}
