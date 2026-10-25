import type { CanvasEngine, DropMark } from "@webforge/engine";

/**
 * What a panel beside the canvas points at on it: an element to outline with its chip (SP-10) and
 * where a layer dragged in Layers would land (SP-8). Made once per window, as the canvas view is;
 * the canvas engine connects to it while it is mounted, and nothing shows while none is. Clearing
 * takes away only what the pointer showed: an outline a breadcrumb set on the engine stays.
 */
export type CanvasPointer = {
  /** Outlines element `nodeId` with its chip, or none (`null`). */
  readonly outline: (nodeId: string | null) => void;
  /** Marks where a dragged layer would land, or nothing (`null`). */
  readonly markDrop: (mark: DropMark | null) => void;
};

/** The window's side of a {@link CanvasPointer}: the editor connects each engine it mounts. */
export type CanvasPointerHost = CanvasPointer & {
  /**
   * Shows what is pointed at on `engine` from now on; returns how to stop, which takes away what
   * it showed.
   */
  readonly connect: (engine: Pick<CanvasEngine, "outline" | "markDrop">) => () => void;
};

/** Creates a pointer with no engine connected. */
export function createCanvasPointer(): CanvasPointerHost {
  let engine: Pick<CanvasEngine, "outline" | "markDrop"> | null = null;
  // What the pointer itself shows, so it clears only that (#421 review).
  let outlined: string | null = null;
  let marked: DropMark | null = null;
  return {
    outline(nodeId) {
      if (nodeId === null && outlined === null) return;
      outlined = nodeId;
      engine?.outline(nodeId);
    },
    markDrop(mark) {
      if (mark === null && marked === null) return;
      marked = mark;
      engine?.markDrop(mark);
    },
    connect(next) {
      engine = next;
      if (outlined !== null) next.outline(outlined);
      if (marked !== null) next.markDrop(marked);
      return () => {
        if (engine !== next) return;
        if (outlined !== null) next.outline(null);
        if (marked !== null) next.markDrop(null);
        engine = null;
      };
    },
  };
}
