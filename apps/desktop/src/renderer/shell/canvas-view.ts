import type { Unsubscribe } from "@webforge/engine";
import { createStore, type StoreApi } from "zustand/vanilla";

/** How big the canvas shows the page: a fixed scale (1 = 100%), or as large as fits. */
export type CanvasZoom = number | "fit";

/** The page's size in CSS pixels and the scale it shows at, for the size readout. */
export type CanvasSize = {
  readonly width: number;
  readonly height: number;
  readonly zoom: number;
};

/**
 * The canvas's zoom and size (F-ED-8). Like the device view, they are view state: never an undo
 * step (U6), and not saved with the site.
 */
export type CanvasViewState = {
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

/** What a canvas engine offers for zoom (the `CanvasEngine` API requested from stream C, #31). */
export type ZoomableCanvas = {
  setZoom(zoom: CanvasZoom): void;
  onCanvasSize(cb: (size: CanvasSize) => void): Unsubscribe;
};

/**
 * Keeps a canvas engine and the canvas view in step: the chosen zoom goes to the engine, and the
 * size and scale it shows come back for the readout. Returns a function that disconnects them.
 */
export function connectCanvasView(engine: ZoomableCanvas, view: CanvasView): () => void {
  engine.setZoom(view.getState().zoom);
  const stopZoom = view.subscribe((state, previous) => {
    if (state.zoom !== previous.zoom) {
      engine.setZoom(state.zoom);
    }
  });
  const stopSize = engine.onCanvasSize((size) => view.setState({ size }));
  return () => {
    stopZoom();
    stopSize();
  };
}
