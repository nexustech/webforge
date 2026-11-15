import type { Layer, LayerShown } from "../editor/layers.js";

/** What the Layers panel can do; the host binds them to the editor session and its commands. */
export type LayersPanelActions = {
  select(id: string): void;
  /** Ctrl/Cmd-click (1.31): adds the layer to the selection, or takes it out. */
  toggle(id: string): void;
  /** Shift-click (1.31): selects these layers, the first the one shown. */
  selectMany(ids: readonly string[]): void;
  rename(id: string, name: string): void;
  /** Shows a layer, hides it while editing, or keeps it off the website (UX-23): one undo step. */
  setShown(id: string, shown: LayerShown): void;
  /** Moves a layer to `index` among its siblings. */
  move(id: string, index: number): void;
  /**
   * Copies a layer to `index` among its siblings as they are now: a Ctrl/Cmd-drag, with Shift for
   * another linked copy of a shared section (1.35, UX-4). Undefined where nothing can be copied.
   */
  copy?(id: string, index: number, linked: boolean): void;
  /** The canvas's own commands on the selected element (1.12); undefined while unavailable. */
  readonly moveUp: (() => void) | undefined;
  readonly moveDown: (() => void) | undefined;
  readonly duplicate: (() => void) | undefined;
  readonly remove: (() => void) | undefined;
};

/** A layer as a row: where it sits among its siblings, so moves stay within its parent. */
export type TreeRow = {
  readonly layer: Layer;
  readonly depth: number;
  readonly parent: string;
  readonly index: number;
  readonly siblings: number;
  /** Its children show below it (it has some, and isn't collapsed). */
  readonly expanded: boolean;
};

/** How the tree is shown: the layers collapsed, and the filter's text. */
type TreeView = {
  readonly collapsed: ReadonlySet<string>;
  /** Lower case; empty for no filter. */
  readonly filter: string;
};

/** Whether `layer`'s name or kind contains `filter`. */
const matches = (layer: Layer, filter: string) =>
  `${layer.name ?? ""} ${layer.kind}`.toLocaleLowerCase().includes(filter);

/** Whether `layer` or a layer inside it matches `filter`. */
const anyMatch = (layer: Layer, filter: string): boolean =>
  matches(layer, filter) || layer.children.some((child) => anyMatch(child, filter));

/**
 * The rows shown: every layer, except those inside a collapsed one; with a filter, the layers
 * that match it and the layers they are in, whatever is collapsed.
 */
export function rowsOf(
  layers: readonly Layer[],
  view: TreeView,
  depth = 1,
  parent = "",
): TreeRow[] {
  return layers.flatMap((layer, index) => {
    if (view.filter !== "" && !anyMatch(layer, view.filter)) return [];
    const expanded =
      layer.children.length > 0 && (view.filter !== "" || !view.collapsed.has(layer.id));
    return [
      { layer, depth, parent, index, siblings: layers.length, expanded },
      ...(expanded ? rowsOf(layer.children, view, depth + 1, layer.id) : []),
    ];
  });
}

/** The ids of the layers `id` is inside, outermost first; empty if it isn't in `layers`. */
export function parentsOf(layers: readonly Layer[], id: string | null): string[] {
  for (const layer of layers) {
    if (layer.id === id) return [];
    const inside = parentsOf(layer.children, id);
    if (inside.length > 0 || layer.children.some((child) => child.id === id)) {
      return [layer.id, ...inside];
    }
  }
  return [];
}

/** Every layer with children: what Collapse all collapses. */
export const withChildren = (layers: readonly Layer[]): string[] =>
  layers.flatMap((layer) =>
    layer.children.length > 0 ? [layer.id, ...withChildren(layer.children)] : [],
  );

/**
 * Where a layer at `from` lands when dropped before or `after` its sibling at `over`, counted once
 * it has left its own place.
 */
export function dropIndex(from: number, over: number, after: boolean): number {
  const target = over + (after ? 1 : 0);
  return target > from ? target - 1 : target;
}

/**
 * Whether the dragged layer can go next to `row`: only among its own siblings; at the top, the
 * page's sections among themselves, and the shared Header's or Footer's among theirs, so they
 * stay first and last (#673).
 */
export const canDropAt = (from: TreeRow, row: TreeRow) =>
  from.parent === row.parent &&
  (row.parent !== "" ||
    (from.layer.region === row.layer.region && from.layer.design === row.layer.design));
