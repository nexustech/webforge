import {
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { Layer } from "../editor/layers.js";
import { isMac } from "../shell/commands.js";
import type { LayersPanelActions } from "./layer-rows.js";
import { parentsOf, rowsOf, type TreeRow, withChildren } from "./layer-rows.js";

/** What {@link useLayersTree} needs: the panel's layers, selection and actions. */
type LayersTreeOptions = {
  readonly layers: readonly Layer[];
  readonly selectedId: string | null;
  readonly alsoSelected: readonly string[];
  readonly actions: LayersPanelActions;
  readonly layoutLocked: boolean;
};

/**
 * The Layers panel's tree as it is shown and walked: which layers are collapsed, the filter, the
 * layer being renamed, where a Shift-click range starts, and the focus. A layer selected elsewhere
 * (the canvas) shows: the layers it is in open once, and can be collapsed again afterwards.
 */
export function useLayersTree({
  layers,
  selectedId,
  alsoSelected,
  actions,
  layoutLocked,
}: LayersTreeOptions) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [filter, setFilter] = useState("");
  const query = filter.trim().toLocaleLowerCase();
  const rows = rowsOf(layers, { collapsed, filter: query });
  const latest = useRef({ layers, selectedId });
  // Kept up to date after each render, for the effect below and for focusing once React has drawn.
  useLayoutEffect(() => {
    latest.current = { layers, selectedId };
  });
  useEffect(() => {
    const parents = parentsOf(latest.current.layers, selectedId);
    setCollapsed((current) =>
      parents.some((id) => current.has(id))
        ? new Set([...current].filter((id) => !parents.includes(id)))
        : current,
    );
  }, [selectedId]);
  const [renaming, setRenaming] = useState<string | null>(null);
  // Where a Shift-click range starts: the last row clicked without Shift, as in file managers.
  const anchor = useRef<string | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const selectedRow = rows.find((row) => row.layer.id === selectedId);

  /** Puts the focus on row `id` once React has drawn: where a closed menu leaves it. */
  const focusRowOnly = (id: string) => {
    requestAnimationFrame(() => {
      treeRef.current?.querySelector<HTMLElement>(`[data-layer="${CSS.escape(id)}"]`)?.focus();
    });
  };

  /** Selects row `id` and focuses it, once React has rendered the selection that moves it. */
  const focusRow = (id: string) => {
    actions.select(id);
    focusRowOnly(id);
  };

  /** Focuses the selected layer's row, as it is once React has drawn it. */
  const focusSelected = () =>
    requestAnimationFrame(() => {
      const id = latest.current.selectedId;
      if (id === null) return;
      treeRef.current?.querySelector<HTMLElement>(`[data-layer="${CSS.escape(id)}"]`)?.focus();
    });

  const setExpanded = (id: string, expanded: boolean) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (expanded) next.delete(id);
      else next.add(id);
      return next;
    });

  /** A click on `row`: Ctrl/Cmd toggles it, Shift selects the range from the anchor (1.31). */
  const click = (event: MouseEvent, row: TreeRow) => {
    const { layer } = row;
    const start = rows.find((each) => each.layer.id === anchor.current) ?? selectedRow;
    if (event.ctrlKey || event.metaKey) {
      anchor.current = layer.id;
      actions.toggle(layer.id);
    } else if (event.shiftKey && start !== undefined) {
      // The rows from the anchor to this one, as they are listed (1.31).
      const from = rows.indexOf(start);
      const to = rows.indexOf(row);
      const range = rows.slice(Math.min(from, to), Math.max(from, to) + 1);
      actions.selectMany([
        layer.id,
        ...range.map((each) => each.layer.id).filter((id) => id !== layer.id),
      ]);
    } else {
      anchor.current = layer.id;
      actions.select(layer.id);
    }
  };

  const keyDown = (event: KeyboardEvent, row: TreeRow) => {
    if (renaming !== null) {
      return;
    }
    const at = rows.indexOf(row);
    // The canvas's keys (F-ED-27): Mod + arrows walk the tree, Mod + Alt + ↑/↓ move (Alt + ↑/↓
    // too, Layers' first keys). Plain arrows move the focus, as in any tree (WAI-ARIA).
    const mod = isMac() ? event.metaKey : event.ctrlKey;
    if ((event.key === "ArrowRight" || event.key === "ArrowLeft") && mod) {
      event.preventDefault();
      const siblings = rows.filter((other) => other.parent === row.parent);
      const sibling = siblings[siblings.indexOf(row) + (event.key === "ArrowRight" ? 1 : -1)];
      if (sibling !== undefined) focusRow(sibling.layer.id);
    } else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const opening = event.key === "ArrowRight";
      if (row.layer.children.length > 0 && row.expanded !== opening && query === "") {
        setExpanded(row.layer.id, opening);
      } else if (opening && row.expanded) {
        const child = rows[at + 1];
        if (child !== undefined) focusRow(child.layer.id);
      } else if (!opening && row.parent !== "") {
        focusRow(row.parent);
      }
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const step = event.key === "ArrowUp" ? -1 : 1;
      if (event.altKey) {
        if (layoutLocked) {
          // Content mode keeps the layout (M3).
        } else if (alsoSelected.length > 0) {
          // Several selected: they all move, as the Edit menu's Move up and down do (1.31).
          (step < 0 ? actions.moveUp : actions.moveDown)?.();
        } else {
          actions.move(row.layer.id, row.index + step);
        }
      } else if (mod && step < 0) {
        if (row.parent !== "") focusRow(row.parent);
      } else if (mod) {
        // The first child as listed: a filter may leave it out, and then there's none to go to.
        const next = rows[at + 1];
        const first = row.layer.children[0];
        if (row.expanded && next?.parent === row.layer.id) {
          focusRow(next.layer.id);
        } else if (!row.expanded && query === "" && first !== undefined) {
          setExpanded(row.layer.id, true);
          focusRow(first.id);
        }
      } else {
        const next = rows[at + step];
        if (next !== undefined) focusRow(next.layer.id);
      }
    } else if (
      event.key === "Enter" &&
      !(mod || event.altKey || event.shiftKey) &&
      actions.editText !== undefined &&
      row.layer.id === selectedId &&
      alsoSelected.length === 0
    ) {
      // As on the canvas (LF-17): Enter on the selected layer edits its text there. An element
      // with no text of its own (a Section) does nothing.
      event.preventDefault();
      actions.editText();
    } else if (event.key === "F2") {
      event.preventDefault();
      setRenaming(row.layer.id);
    } else if ((event.key === "Delete" || event.key === "Backspace") && actions.remove) {
      // The canvas's Delete shortcut leaves keys in a tree to the tree: delete the selected layer.
      event.preventDefault();
      actions.remove();
    }
  };

  return {
    rows,
    selectedRow,
    treeRef,
    filter,
    setFilter,
    /** The filter as matched: trimmed, lower case; empty for none. */
    query,
    renaming,
    setRenaming,
    /** The layer selected now, once React has drawn: for the element menu's Rename. */
    latestSelected: () => latest.current.selectedId,
    focusRow,
    focusRowOnly,
    focusSelected,
    setExpanded,
    expandAll: () => setCollapsed(new Set()),
    collapseAll: () => setCollapsed(new Set(withChildren(layers))),
    click,
    keyDown,
  };
}
