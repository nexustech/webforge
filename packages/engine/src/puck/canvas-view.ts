import type { PuckAction } from "@puckeditor/core";
import { DESKTOP_FROM } from "@webforge/model";
import type { CanvasSize, Unsubscribe, Viewport } from "../canvas-engine.js";
import { emitter, type PuckHandle, VIEWPORT_WIDTHS, viewportOf } from "./engine-support.js";
import { puckPrivateApi } from "./puck-dom.js";

/**
 * The canvas's width, zoom and size (1.15): the app's device view or width shown in Puck, the
 * user's own choice reported back, and the size and zoom Puck measures, reported once they change.
 * Desktop fills the canvas, as a site fills a browser (PH2-18): its width is the room the canvas
 * has, kept up to date as that changes, but never under {@link DESKTOP_FROM}, where the site's
 * desktop layout starts; a narrower canvas shows it zoomed out instead.
 */
export type CanvasView = {
  /** The width Puck shows, or is about to show. */
  width(): number;
  /**
   * The width Puck starts with: the full canvas while Desktop's room isn't measured yet, so the
   * page is laid out once at its own width rather than at a guess and then again (PH2-18).
   */
  startWidth(): number | "100%";
  /** Shows `viewport` in Puck, now or once Puck is ready. */
  setViewport(viewport: Viewport): void;
  /** Shows the width in Puck if it isn't already: the Bridge calls this once Puck is ready. */
  show(): void;
  /** The canvas has `width` CSS pixels of room for the page: Desktop takes it (PH2-18). */
  fit(width: number): void;
  /** Puck shows `width`: the app's own width arriving, or the user's choice in Puck's controls. */
  shown(width: number | "100%"): void;
  /** Scales Puck's canvas to `zoom`, or to its fitting zoom. Does nothing before Puck is ready. */
  zoom(zoom: number | "fit"): void;
  /** Reports the size at the next frame, if it changed. */
  measure(): void;
  /** Stops a size about to be reported. */
  stopMeasuring(): void;
  /** Puck went away: no width is on its way to it. */
  forgetPending(): void;
  /** Calls `cb` with each new size and zoom, and at once with the current one if there is one. */
  onSize(cb: (size: CanvasSize) => void): Unsubscribe;
  /** Calls `cb` with each view the user chose in Puck. */
  onViewport(cb: (viewport: Viewport) => void): Unsubscribe;
};

/** A new {@link CanvasView} on Puck (`puck`), changed through `dispatch`. Desktop at first. */
export function createCanvasView(
  puck: PuckHandle,
  dispatch: (action: PuckAction) => void,
): CanvasView {
  /** The view the app chose: Desktop's width follows the canvas, the others are fixed. */
  let chosen: Viewport = "desktop";
  /** The room the canvas has, once measured. */
  let room: number | null = null;
  const widthFor = (viewport: Viewport): number =>
    viewport === "desktop"
      ? Math.max(DESKTOP_FROM, room ?? VIEWPORT_WIDTHS.desktop)
      : typeof viewport === "number"
        ? viewport
        : VIEWPORT_WIDTHS[viewport];
  let width = widthFor(chosen);
  /** A width given to Puck that Puck doesn't show yet: until it does, no width is reported. */
  let pending: number | null = null;
  /** The size and zoom last reported. */
  let size: CanvasSize | null = null;
  let frame: number | null = null;
  const sizes = emitter<CanvasSize>();
  const viewports = emitter<Viewport>();

  const show = () => {
    const api = puck();
    if (api === null) return;
    // Desktop before the canvas is measured: Puck fills it already (`startWidth`).
    if (chosen === "desktop" && room === null) return;
    // A width still on its way to Puck counts as shown: a later one must replace it.
    if ((pending ?? api.appState.ui.viewports.current.width) === width) return;
    pending = width;
    const next = width;
    dispatch({
      type: "setUi",
      ui: (ui) => ({ viewports: { ...ui.viewports, current: { width: next, height: "auto" } } }),
    });
  };

  /** Reports the canvas's size and zoom if they changed, once Puck has measured the canvas. */
  const report = () => {
    frame = null;
    const api = puck();
    const config = api === null ? undefined : puckPrivateApi(api)?.getZoomConfig();
    const shownWidth = api?.appState.ui.viewports.current.width;
    if (config === undefined || typeof shownWidth !== "number" || !(config.rootHeight > 0)) return;
    const next = { width: shownWidth, height: Math.round(config.rootHeight), zoom: config.zoom };
    if (
      size === null ||
      size.width !== next.width ||
      size.height !== next.height ||
      size.zoom !== next.zoom
    ) {
      size = next;
      sizes.emit(next);
    }
  };

  return {
    width: () => width,
    startWidth: () => (chosen === "desktop" && room === null ? "100%" : width),
    setViewport(viewport) {
      chosen = viewport;
      width = widthFor(viewport);
      show();
    },
    show,
    fit(next) {
      room = Math.floor(next);
      if (chosen !== "desktop" || widthFor(chosen) === width) return;
      width = widthFor(chosen);
      show();
    },
    shown(shownWidth) {
      if (pending !== null) {
        if (shownWidth === pending) pending = null;
        return;
      }
      if (typeof shownWidth === "number" && shownWidth !== width) {
        width = shownWidth;
        chosen = viewportOf(shownWidth);
        viewports.emit(chosen);
      }
    },
    zoom(zoom) {
      const api = puck();
      const access = api === null ? undefined : puckPrivateApi(api);
      if (access === undefined) return;
      const config = access.getZoomConfig();
      const next = zoom === "fit" ? config.autoZoom : zoom;
      if (Number.isFinite(next) && next > 0 && next !== config.zoom) {
        access.setZoomConfig({ ...config, zoom: next });
      }
    },
    // At the next frame: Puck sets a new zoom and the height that goes with it in two renders,
    // which then arrive as one change.
    measure() {
      frame ??= requestAnimationFrame(report);
    },
    stopMeasuring() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    },
    forgetPending() {
      pending = null;
    },
    onSize(cb) {
      if (size !== null) cb(size);
      return sizes.add(cb);
    },
    onViewport: viewports.add,
  };
}
