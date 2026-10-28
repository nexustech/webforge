import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";

/** Where a dragged row lands on another: before it, after it, or into it (a dropdown). */
type RowDropPlace = "before" | "after" | "into";

/** Where the dragged row would land now, and whether it may: shown on the row it is over. */
type RowDrop = {
  readonly key: string;
  readonly place: RowDropPlace;
  readonly allowed: boolean;
};

/** The keys held during a drag: Ctrl/Cmd copies (UX-4), with Shift a linked copy (1.35). */
export type RowDragKeys = {
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
};

/** What {@link useRowDrag} needs to know about a list. */
export type RowDragOptions<R> = {
  /** The list's own name (`application/x-webforge-…`): rows of another list are ignored. */
  readonly type: string;
  /** The list's rows, each with its {@link rowProps}. */
  readonly rows: readonly R[];
  /** A row's key: what {@link RowDrop.key} names. */
  readonly keyOf: (row: R) => string;
  /**
   * Where the dragged row `from` would land on `row`, with the pointer `y` of the way down it (0
   * at its top, 1 at its bottom), or null where dropping there means nothing (no mark at all).
   * Before or after it by halves unless given.
   */
  readonly place?: (from: R, row: R, y: number, keys: RowDragKeys) => RowDropPlace | null;
  /** Whether `from` may land on `row`; a row it may not is marked so before anything is dropped. */
  readonly allowed?: (from: R, row: R) => boolean;
  /** Whether this drag copies rather than moves, with the keys held now. */
  readonly copying?: (keys: RowDragKeys) => boolean;
  /** `from` dropped on `row`, at `place`, with the keys held as it was let go. */
  readonly onDrop: (from: R, row: R, place: RowDropPlace, keys: RowDragKeys) => void;
};

/** What {@link useRowDrag} gives a list: each row's drag props, and where a drop would land. */
export type RowDrag<R> = {
  /** The row being dragged, while one is. */
  readonly dragging: R | null;
  /** Where the dragged row would land, on the row it is over. */
  readonly drop: RowDrop | null;
  /** The props a row needs; `draggable` decides whether it can be picked up. */
  readonly rowProps: (
    row: R,
    draggable?: boolean,
  ) => {
    /** Never the browser's own drag: the row's text or icons would go instead. */
    readonly draggable: false;
    readonly "data-row-drag": string;
    readonly "data-row-key": string;
    readonly "data-row-draggable": "true" | "false";
    readonly onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  };
  /** The classes that mark where the dragged row would land on `row`, if it is over it. */
  readonly indicatorClass: (row: R) => string | undefined;
};

/** How far the pointer moves, held down on a row, before the row is picked up: a click is not. */
const DRAG_DISTANCE = 4;

const halves = <R>(_from: R, _row: R, y: number): RowDropPlace => (y > 0.5 ? "after" : "before");

const keysOf = (event: {
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): RowDragKeys => ({
  ctrlKey: event.ctrlKey,
  metaKey: event.metaKey,
  shiftKey: event.shiftKey,
  altKey: event.altKey,
});

/** Whether two drops mark the same place, so the marks needn't change. */
function sameDrop(a: RowDrop | null, b: RowDrop | null): boolean {
  if (a === null || b === null) return a === b;
  return a.key === b.key && a.place === b.place && a.allowed === b.allowed;
}

/** A row press that may become a drag. */
type Press<R> = {
  readonly row: R;
  readonly x: number;
  readonly y: number;
  readonly pointerId: number;
};

/**
 * Drag-and-drop of rows in a list (Layers, the menu editor; later Pages), with pointer events
 * (#271): a row pressed and moved a few pixels is picked up; where it would land on the row under
 * the pointer (before, after or into it) is marked as it moves, and the rows it may not go to
 * before anything is dropped; letting go drops it, and Escape puts it back. Keys held before the
 * press count, as the browser's own drag would ignore them (Ctrl/Cmd + Shift, a linked copy).
 * Rows of another list are ignored. Keyboard moves (Alt+↑/↓) are each list's.
 */
export function useRowDrag<R>({
  type,
  rows,
  keyOf,
  place = halves,
  allowed = () => true,
  copying = () => false,
  onDrop,
}: RowDragOptions<R>): RowDrag<R> {
  // In state too, so the rows it can't go to are marked while it moves.
  const [dragging, setDragging] = useState<R | null>(null);
  const [drop, setDrop] = useState<RowDrop | null>(null);
  // Ends the drag going on: the window's listeners outlive a render.
  const stop = useRef<(() => void) | null>(null);
  // A drag still going when the list goes ends with it.
  useEffect(() => () => stop.current?.(), []);

  /** The row of this list under `target`, its element, and its key. */
  const rowAt = (target: EventTarget | null) => {
    const element =
      target instanceof Element ? target.closest<HTMLElement>("[data-row-drag]") : null;
    if (element === null || element.dataset.rowDrag !== type) return undefined;
    const key = element.dataset.rowKey ?? "";
    const row = rows.find((each) => keyOf(each) === key);
    return row === undefined ? undefined : { element, key, row };
  };

  /** Where the dragged row `from` would land under `event`, and whether it may. */
  const landing = (from: R, event: PointerEvent) => {
    const over = rowAt(event.target);
    if (over === undefined) return null;
    // How far down the row the pointer is: 0 at its top, 1 at its bottom (below a row with no
    // height, as without a layout, anywhere under its top counts as its bottom).
    const box = over.element.getBoundingClientRect();
    const y = (event.clientY - box.top) / box.height;
    const keys = keysOf(event);
    const at = place(from, over.row, y, keys);
    return at === null ? null : { ...over, place: at, allowed: allowed(from, over.row), keys };
  };

  /** Follows a press from `press`: picks the row up once it moves, and drops it when let go. */
  const follow = (press: Press<R>) => {
    stop.current?.();
    let picked = false;
    let shown: RowDrop | null = null;
    const body = document.body;
    const cursor = body.style.cursor;
    const userSelect = body.style.userSelect;
    const show = (next: RowDrop | null) => {
      if (sameDrop(next, shown)) return;
      shown = next;
      setDrop(next);
    };
    const end = () => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", end, true);
      window.removeEventListener("keydown", key, true);
      stop.current = null;
      if (!picked) return;
      body.style.cursor = cursor;
      body.style.userSelect = userSelect;
      setDragging(null);
      setDrop(null);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerId !== press.pointerId) return;
      if (!picked) {
        if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < DRAG_DISTANCE) return;
        picked = true;
        setDragging(press.row);
        body.style.userSelect = "none";
        window.getSelection()?.removeAllRanges();
      }
      const at = landing(press.row, event);
      show(at === null ? null : { key: at.key, place: at.place, allowed: at.allowed });
      body.style.cursor =
        at !== null && !at.allowed ? "not-allowed" : copying(keysOf(event)) ? "copy" : "grabbing";
    };
    const up = (event: PointerEvent) => {
      if (event.pointerId !== press.pointerId) return;
      const wasPicked = picked;
      const at = picked ? landing(press.row, event) : null;
      end();
      if (!wasPicked) return;
      // The click that follows letting go isn't one: the row was dragged, not clicked. It comes
      // straight after, or not at all: the next press, or the next task, ends the wait.
      const swallow = (click: MouseEvent) => {
        click.preventDefault();
        click.stopPropagation();
        forget();
      };
      const forget = () => {
        window.removeEventListener("click", swallow, true);
        window.removeEventListener("pointerdown", forget, true);
      };
      window.addEventListener("click", swallow, true);
      window.addEventListener("pointerdown", forget, true);
      setTimeout(forget, 0);
      if (at?.allowed) onDrop(press.row, at.row, at.place, at.keys);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !picked) return;
      // Puts the row back, and is nothing else's Escape.
      event.preventDefault();
      event.stopPropagation();
      end();
    };
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", end, true);
    window.addEventListener("keydown", key, true);
    stop.current = end;
  };

  return {
    dragging,
    drop,
    rowProps: (row, draggable = true) => {
      const key = keyOf(row);
      return {
        draggable: false,
        "data-row-drag": type,
        "data-row-key": key,
        "data-row-draggable": draggable ? "true" : "false",
        onPointerDown: (event) => {
          // The main button on this row itself, not on a row inside it (a dropdown's items).
          if (!draggable || event.button !== 0 || rowAt(event.target)?.key !== key) return;
          follow({ row, x: event.clientX, y: event.clientY, pointerId: event.pointerId });
        },
      };
    },
    indicatorClass: (row) => {
      if (drop?.key !== keyOf(row)) return undefined;
      if (!drop.allowed) return "shadow-[inset_0_0_0_1px_var(--destructive)]";
      // A 1 px line in the accent between the rows (SP-8); a ring round a row it goes into.
      return drop.place === "before"
        ? "shadow-[inset_0_1px_0_var(--primary)]"
        : drop.place === "after"
          ? "shadow-[inset_0_-1px_0_var(--primary)]"
          : "ring-2 ring-ring ring-inset";
    },
  };
}
