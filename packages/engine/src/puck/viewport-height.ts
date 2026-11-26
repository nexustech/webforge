import type { CanvasSize } from "../canvas-engine.js";

/** The window's height a page's sections read (HH-4): a _Whole screen_ or _Tall_ Hero's. */
const HEIGHT = "--wf-viewport-h";

/**
 * Gives the canvas's page the height a visitor's window would have (HH-4): the part of the page in
 * view, in its own CSS pixels, so at any zoom (`CanvasSize.height`). The canvas's frame grows with
 * its page, so `vh` there is the page's height, and a section as tall as the window would keep
 * growing; sections read `--wf-viewport-h` instead, which the export and Storybook leave unset for
 * the small viewport's height. Set at once from `fallback` (the editor window's), then from each
 * size the canvas reports. Returns what stops it.
 */
export function followViewportHeight(
  doc: Document,
  sizes: (listener: (size: CanvasSize) => void) => () => void,
  fallback?: number,
): () => void {
  const root = doc.documentElement;
  const set = (height: number) => root.style.setProperty(HEIGHT, `${Math.round(height)}px`);
  if (fallback !== undefined && fallback > 0) set(fallback);
  const stop = sizes((size) => {
    if (size.height > 0) set(size.height);
  });
  return () => {
    stop();
    root.style.removeProperty(HEIGHT);
  };
}
