import { canvasZoom } from "./chrome.js";
import { elementOf } from "./puck-dom.js";

/** The room kept above an element shown from outside the canvas, for its selection bar, on screen. */
export const ROOM_ABOVE = 48;
/** The room kept below it, on screen. */
export const ROOM_BELOW = 16;
/**
 * How often, and how many times, to look again for an element the canvas hasn't drawn yet (a
 * section just added, or one on a page just shown): about a second in all. On timers, not
 * animation frames, which a window behind others doesn't get.
 */
const RETRY_MS = 16;
const TRIES = 60;

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
  let shown: string | null = null;
  /** The window and timer of the next look for {@link shown}, while the canvas hasn't drawn it. */
  let waiting: { readonly view: Window; readonly timer: number } | null = null;

  const stopWaiting = () => {
    waiting?.view.clearTimeout(waiting.timer);
    waiting = null;
  };

  /** Shows {@link shown} if the canvas has drawn it, or looks again in a moment. */
  const show = (tries: number) => {
    waiting = null;
    const doc = document();
    const view = doc?.defaultView;
    if (shown === null || doc === undefined || view === null || view === undefined) return;
    const element = elementOf(doc, shown);
    if (element === undefined || element === null) {
      // A page just shown draws its elements a moment later; one that never comes is gone.
      if (tries < TRIES) {
        waiting = { view, timer: view.setTimeout(() => show(tries + 1), RETRY_MS) };
      } else {
        shown = null;
      }
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

  return {
    toTop() {
      // An element of the page before is no longer there to show.
      stopWaiting();
      shown = null;
      document()?.defaultView?.scrollTo(0, 0);
    },
    reveal(id) {
      stopWaiting();
      shown = id;
      show(0);
    },
    cancel() {
      stopWaiting();
      shown = null;
    },
  };
}
