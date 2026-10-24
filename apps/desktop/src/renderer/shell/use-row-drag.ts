import { type DragEvent, useRef, useState } from "react";

/** Where a dragged row lands on another: before it, after it, or into it (a dropdown). */
export type RowDropPlace = "before" | "after" | "into";

/** Where the dragged row would land now, and whether it may: shown on the row it is over. */
export type RowDrop = {
  readonly key: string;
  readonly place: RowDropPlace;
  readonly allowed: boolean;
};

/** What {@link useRowDrag} needs to know about a list. */
export type RowDragOptions<R> = {
  /** The MIME type a dragged row travels as (`application/x-webforge-…`). */
  readonly type: string;
  /** A row's key: the id it travels as, and what {@link RowDrop.key} names. */
  readonly keyOf: (row: R) => string;
  /**
   * Where the dragged row `from` would land on `row`, with the pointer `y` of the way down it (0
   * at its top, 1 at its bottom), or null where dropping there means nothing (no mark at all).
   * Before or after it by halves unless given.
   */
  readonly place?: (from: R, row: R, y: number, event: DragEvent) => RowDropPlace | null;
  /** Whether `from` may land on `row`; a row it may not is marked so before anything is dropped. */
  readonly allowed?: (from: R, row: R) => boolean;
  /** Whether rows can be copied as well as moved (Ctrl/Cmd held, UX-4). */
  readonly copies?: boolean;
  /** Whether this drag copies rather than moves. */
  readonly copying?: (event: DragEvent) => boolean;
  /** `from` dropped on `row`, at `place`. */
  readonly onDrop: (from: R, row: R, place: RowDropPlace, event: DragEvent) => void;
};

/** What {@link useRowDrag} gives a list: each row's drag handlers, and where a drop would land. */
export type RowDrag<R> = {
  /** The row being dragged, while one is. */
  readonly dragging: R | null;
  /** Where the dragged row would land, on the row it is over. */
  readonly drop: RowDrop | null;
  /** The handlers a row needs; `draggable` decides whether it can be picked up. */
  readonly rowProps: (
    row: R,
    draggable?: boolean,
  ) => {
    readonly draggable: boolean;
    readonly onDragStart: (event: DragEvent) => void;
    readonly onDragEnd: () => void;
    readonly onDragOver: (event: DragEvent) => void;
    readonly onDragLeave: (event: DragEvent) => void;
    readonly onDrop: (event: DragEvent) => void;
  };
  /** The classes that mark where the dragged row would land on `row`, if it is over it. */
  readonly indicatorClass: (row: R) => string | undefined;
};

/**
 * How far down the row the pointer is: 0 at its top, 1 at its bottom (below a row with no height,
 * as without a layout, anywhere under its top counts as its bottom).
 */
const heightAt = (event: DragEvent) => {
  const box = event.currentTarget.getBoundingClientRect();
  return (event.clientY - box.top) / box.height;
};

const halves = <R>(_from: R, _row: R, y: number): RowDropPlace => (y > 0.5 ? "after" : "before");

/**
 * Drag-and-drop of rows in a list (Layers, the menu editor; later Pages), with HTML5 drag events:
 * the row being dragged, where it would land on the row under the pointer (before, after or into
 * it), marked as it moves, and the rows it may not go to marked before anything is dropped. Rows
 * dragged from another list (another type) are ignored. Keyboard moves (Alt+↑/↓) are each list's.
 */
export function useRowDrag<R>({
  type,
  keyOf,
  place = halves,
  allowed = () => true,
  copies = false,
  copying = () => false,
  onDrop,
}: RowDragOptions<R>): RowDrag<R> {
  // In state too, so the rows it can't go to are marked while it moves.
  const [dragging, setDragging] = useState<R | null>(null);
  const dragged = useRef<R | null>(null);
  const [drop, setDrop] = useState<RowDrop | null>(null);

  /** Where `event` is over `row`, and whether the dragged row may land there. */
  const landing = (event: DragEvent, row: R) => {
    const from = dragged.current;
    if (from === null) return null;
    const at = place(from, row, heightAt(event), event);
    return at === null ? null : { from, place: at, allowed: allowed(from, row) };
  };

  return {
    dragging,
    drop,
    rowProps: (row, draggable = true) => ({
      draggable,
      onDragStart: (event) => {
        dragged.current = row;
        setDragging(row);
        event.dataTransfer.effectAllowed = copies ? "copyMove" : "move";
        event.dataTransfer.setData(type, keyOf(row));
      },
      onDragEnd: () => {
        dragged.current = null;
        setDragging(null);
        setDrop(null);
      },
      onDragOver: (event) => {
        const at = landing(event, row);
        if (at === null) return;
        if (at.allowed) {
          event.preventDefault();
          event.dataTransfer.dropEffect = copying(event) ? "copy" : "move";
        } else {
          // Not a drop target: the pointer shows it can't go here, before anything is dropped.
          event.dataTransfer.dropEffect = "none";
        }
        const key = keyOf(row);
        if (drop?.key !== key || drop.place !== at.place || drop.allowed !== at.allowed) {
          setDrop({ key, place: at.place, allowed: at.allowed });
        }
      },
      onDragLeave: (event) => {
        // Moving onto the row's own label or button isn't leaving it.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDrop(null);
      },
      onDrop: (event) => {
        const at = landing(event, row);
        event.preventDefault();
        setDrop(null);
        if (at !== null && at.allowed) onDrop(at.from, row, at.place, event);
      },
    }),
    indicatorClass: (row) => {
      if (drop?.key !== keyOf(row)) return undefined;
      if (!drop.allowed) return "shadow-[inset_0_0_0_1px_var(--destructive)]";
      return drop.place === "before"
        ? "shadow-[inset_0_2px_0_var(--ring)]"
        : drop.place === "after"
          ? "shadow-[inset_0_-2px_0_var(--ring)]"
          : "ring-2 ring-ring ring-inset";
    },
  };
}
