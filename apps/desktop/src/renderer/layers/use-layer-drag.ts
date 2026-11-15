import { useEffect, useRef, useState } from "react";
import type { CanvasPointer } from "../editor/canvas-pointer.js";
import type { Layer } from "../editor/layers.js";
import { type RowDragKeys, useRowDrag } from "../shell/use-row-drag.js";
import { canDropAt, dropIndex, type LayersPanelActions, type TreeRow } from "./layer-rows.js";

/** The MIME type a dragged layer travels as, so drops from elsewhere are ignored. */
const DRAG_TYPE = "application/x-webforge-layer";

/** What {@link useLayerDrag} needs: the panel's layers, its rows as shown, and the canvas. */
type LayerDragOptions = {
  readonly layers: readonly Layer[];
  readonly rows: readonly TreeRow[];
  readonly actions: LayersPanelActions;
  readonly canvas: CanvasPointer | undefined;
};

/**
 * Dragging layers among their siblings (1.35), a Ctrl/Cmd-drag copying them (UX-4), and what the
 * panel shows on the canvas beside it: the element of the row under the pointer, outlined with its
 * chip (SP-10), and where a dragged layer would land (SP-8).
 */
export function useLayerDrag({ layers, rows, actions, canvas }: LayerDragOptions) {
  /** How many top-level rows the shared `region` has. */
  const regionRows = (region: Layer["region"]) =>
    layers.filter((layer) => layer.region === region).length;

  /** Whether a drag copies what it drags: Ctrl or Cmd held, as on the canvas (UX-4). */
  const copying = (keys: RowDragKeys) =>
    actions.copy !== undefined && (keys.ctrlKey || keys.metaKey);

  const rowDrag = useRowDrag<TreeRow>({
    type: DRAG_TYPE,
    rows,
    keyOf: (row) => row.layer.id,
    // A copy may go next to the layer it copies; a move to its own place changes nothing.
    place: (from, row, y, event) =>
      from.layer.id === row.layer.id && !copying(event) ? null : y > 0.5 ? "after" : "before",
    allowed: canDropAt,
    copying,
    onDrop: (from, row, place, keys) => {
      const after = place === "after";
      if (copying(keys)) {
        // Next to the row it was dropped on, counted with the original still there; Shift held
        // from before the press too, as the browser's own drag couldn't (#271).
        actions.copy?.(from.layer.id, row.index + (after ? 1 : 0), keys.shiftKey);
      } else if (from.layer.id !== row.layer.id) {
        actions.move(from.layer.id, dropIndex(from.index, row.index, after));
      }
    },
  });
  const { dragging, drop } = rowDrag;
  // Where the dragged layer would land, on the canvas too (SP-8).
  const dropMark =
    dragging === null || drop === null || !drop.allowed || drop.place === "into"
      ? null
      : { nodeId: drop.key, place: drop.place, name: dragging.layer.name ?? dragging.layer.kind };
  const dropKey = dropMark === null ? "" : `${dropMark.nodeId} ${dropMark.place}`;
  // The row under the pointer: its element stays outlined until the pointer leaves it, or the row
  // goes (deleted, collapsed or filtered out), which leaves no pointerleave to clear it.
  const [hovered, setHovered] = useState<string | null>(null);
  const outlinedId =
    hovered !== null && rows.some((row) => row.layer.id === hovered) ? hovered : null;
  // What the panel has shown on the canvas, so it clears only that: an outline a breadcrumb set
  // stays (#421 review).
  const shown = useRef<{ outline: string | null; drop: string }>({ outline: null, drop: "" });
  useEffect(() => {
    if (shown.current.outline === outlinedId) return;
    shown.current.outline = outlinedId;
    canvas?.outline(outlinedId);
  }, [canvas, outlinedId]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: redrawn when where it lands changes.
  useEffect(() => {
    if (shown.current.drop === dropKey) return;
    shown.current.drop = dropKey;
    canvas?.markDrop(dropMark);
  }, [canvas, dropKey]);
  // Nothing stays outlined or marked once the panel goes.
  useEffect(
    () => () => {
      if (shown.current.outline !== null) canvas?.outline(null);
      if (shown.current.drop !== "") canvas?.markDrop(null);
      shown.current = { outline: null, drop: "" };
    },
    [canvas],
  );

  return {
    rowDrag,
    dragging,
    /** Whether the layer being dragged can't go next to `row` (outside its own list). */
    notAllowed: (row: TreeRow) =>
      dragging !== null && dragging.layer.id !== row.layer.id && !canDropAt(dragging, row),
    /**
     * Whether `row` can be picked up, apart from what the panel decides (content mode, renaming,
     * several selected): a Blog design's sections stay where they are (#936), as the canvas keeps
     * them, and the shared Header and Footer stay first and last, theirs moving among their own
     * (#673).
     */
    movable: (row: TreeRow) =>
      row.layer.locked !== true &&
      !(row.parent === "" && row.layer.region !== undefined && regionRows(row.layer.region) < 2),
    /** The pointer entered row `id`: its element is outlined on the canvas (SP-10). */
    hover: (id: string) => setHovered(id),
    /** The pointer left row `id`. */
    leave: (id: string) => setHovered((current) => (current === id ? null : current)),
  };
}
