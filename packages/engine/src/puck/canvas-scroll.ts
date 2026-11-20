import { canvasZoom } from "./chrome.js";
import { elementOf } from "./puck-dom.js";

/** The room kept above an element shown from outside the canvas, for its selection bar, on screen. */
export const ROOM_ABOVE = 48;
/** The room kept below it, on screen. */
export const ROOM_BELOW = 16;
/** How many frames to wait for an element that a page just shown hasn't drawn yet (about 1 s). */
const FRAMES_TO_WAIT = 60;

/**
 * How far to scroll a view `height` tall to show a box from `top` to `bottom` (both measured from
 * the view's top), with `above` free over it for its selection bar and `below` under it: 0 when it
 * shows already. A box taller than the view shows its top.
 */
export function revealOffset(
  top: number,
  bottom: number,
  height: number,
  above: number,
  below: number,
): number {
  if (top < above) return top - above;
  if (bottom <= height - below) return 0;
  return Math.min(bottom - (height - below), top - above);
}

/**
 * The canvas's scrolling (#1176): a page shown opens at its top, and an element selected from
 * outside the canvas (Site Check, Layers, Find, the breadcrumbs, an undo) scrolls into view.
 */
export type CanvasScroll = {
  /** Shows the top of the page, which the canvas has just started showing. */
  toTop(): void;
  /** Scrolls element `id` into view, clear of its selection bar, once the canvas has drawn it. */
  reveal(id: string): void;
  /** Forgets what was still to do: the canvas goes. */
  cancel(): void;
};

/** A new {@link CanvasScroll} for the canvas's document, `document` (none before Puck is ready). */
export function createCanvasScroll(document: () => Document | undefined): CanvasScroll {
  let top = false;
  let shown: string | null = null;
  /** The window and frame of the step waiting for the next frame, if one is. */
  let waiting: { readonly view: Window; readonly frame: number } | null = null;

  const step = (frames: number) => {
    waiting = null;
    const doc = document();
    const view = doc?.defaultView;
    if (doc === undefined || view === null || view === undefined) return;
    if (top) {
      top = false;
      view.scrollTo(0, 0);
    }
    if (shown === null) return;
    const element = elementOf(doc, shown);
    if (element === undefined || element === null) {
      // A page just shown draws its elements a moment later; one that never comes is gone.
      if (frames < FRAMES_TO_WAIT) schedule(frames + 1);
      else shown = null;
      return;
    }
    shown = null;
    const box = element.getBoundingClientRect();
    // The rooms are on screen; the canvas's own pixels are smaller when it is zoomed in.
    const zoom = canvasZoom(doc.documentElement);
    const offset = revealOffset(
      box.top,
      box.bottom,
      view.innerHeight,
      ROOM_ABOVE / zoom,
      ROOM_BELOW / zoom,
    );
    if (offset !== 0) view.scrollBy(0, offset);
  };

  /** Runs the next step at the next frame, after Puck has drawn what changed. */
  const schedule = (frames = 0) => {
    const view = document()?.defaultView;
    if (view === null || view === undefined) return;
    if (waiting !== null) {
      if (waiting.view === view) return;
      // The canvas has a new window: the old one's frame may never come.
      waiting.view.cancelAnimationFrame(waiting.frame);
    }
    waiting = { view, frame: view.requestAnimationFrame(() => step(frames)) };
  };

  return {
    toTop() {
      top = true;
      // An element of the page before is no longer there to show.
      shown = null;
      schedule();
    },
    reveal(id) {
      shown = id;
      schedule();
    },
    cancel() {
      top = false;
      shown = null;
      waiting?.view.cancelAnimationFrame(waiting.frame);
      waiting = null;
    },
  };
}
