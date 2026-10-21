import type { CanvasEngine, CanvasSize } from "@webforge/engine";
import { createStore, type StoreApi } from "zustand/vanilla";

/** How big the canvas shows the page: a fixed scale (1 = 100%), or as large as fits. */
export type CanvasZoom = number | "fit";

/**
 * The canvas's zoom and size (F-ED-8). Like the device view, they are view state: never an undo
 * step (U6), and not saved with the site.
 */
type CanvasViewState = {
  readonly zoom: CanvasZoom;
  /** Unknown until the canvas has shown the page. */
  readonly size: CanvasSize | null;
};

/** A store of {@link CanvasViewState}; one per window. */
export type CanvasView = StoreApi<CanvasViewState>;

/** A new canvas view: fitted, size unknown. */
export function createCanvasView(): CanvasView {
  return createStore<CanvasViewState>()(() => ({ zoom: "fit", size: null }));
}

/** The zoom levels the toolbar offers, besides Fit. */
export const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.5, 2] as const;

/** What a canvas engine offers for zoom (#130). */
type ZoomableCanvas = Pick<CanvasEngine, "setZoom" | "onCanvasSize">;

/** Scales this close are the same zoom (reports round, and floats aren't exact). */
const sameZoom = (a: number, b: number) => Math.abs(a - b) < 0.005;

/**
 * Keeps a canvas engine and the canvas view in step: the chosen zoom goes to the engine, and the
 * size and scale it shows come back for the readout. The engine's reports are the truth: the
 * canvas fits the page again whenever its frame or the device view changes, so a chosen zoom that
 * the canvas no longer shows becomes Fit. A report sent before a chosen zoom took effect is only
 * shown, not taken for a re-fit, and the zoom is asked for once more, since an engine that wasn't
 * ready yet drops it. Returns a function that disconnects them.
 */
export function connectCanvasView(engine: ZoomableCanvas, view: CanvasView): () => void {
  /** A zoom asked of the engine that no report has shown yet. */
  let requested: number | null = null;
  /** Whether `requested` was asked for again after a report that didn't show it. */
  let askedAgain = false;
  const send = (zoom: CanvasZoom) => {
    requested = zoom === "fit" ? null : zoom;
    askedAgain = false;
    engine.setZoom(zoom);
  };
  send(view.getState().zoom);
  const stopZoom = view.subscribe((state, previous) => {
    // Also after a re-fit set Fit below: asking a fitted canvas to fit again changes nothing.
    if (state.zoom !== previous.zoom) {
      send(state.zoom);
    }
  });
  const stopSize = engine.onCanvasSize((size) => {
    const { zoom } = view.getState();
    if (requested !== null) {
      if (sameZoom(size.zoom, requested)) {
        requested = null;
        view.setState({ size });
        return;
      }
      if (!askedAgain) {
        askedAgain = true;
        engine.setZoom(requested);
        view.setState({ size });
        return;
      }
      // Asked twice and still not shown: the canvas fits the page instead.
      requested = null;
    }
    const refitted = zoom !== "fit" && !sameZoom(size.zoom, zoom);
    view.setState(refitted ? { size, zoom: "fit" } : { size });
  });
  return () => {
    stopZoom();
    stopSize();
  };
}
