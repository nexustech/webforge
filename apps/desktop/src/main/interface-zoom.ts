import type { TitleBarOverlayOptions } from "electron";
import {
  type EditorTheme,
  titleBarOverlay,
  trafficLightPosition,
  zoomedMinimumSize,
} from "./window-options.js";

/** The parts of a `BrowserWindow` the interface zoom changes. */
export type ZoomableWindow = {
  readonly webContents: { setZoomFactor(factor: number): void };
  setMinimumSize(width: number, height: number): void;
  setTitleBarOverlay(options: TitleBarOverlayOptions): void;
  setWindowButtonPosition(position: { x: number; y: number } | null): void;
};

/**
 * Zooms the editor's window to `zoom` (View › Zoom In Interface): its page, with the canvas inside
 * it, and the native title bar's controls to the page's scaled title bar. The smallest window grows
 * with it (`zoomedMinimumSize`), so the editor keeps the room it is laid out for. The exported
 * site is never touched: only this window's scale changes.
 */
export function applyInterfaceZoom(
  window: ZoomableWindow,
  zoom: number,
  context: {
    readonly platform: NodeJS.Platform;
    readonly theme: EditorTheme;
    /** The work area of the screen the window is on. */
    readonly workArea: { readonly width: number; readonly height: number };
  },
): void {
  window.webContents.setZoomFactor(zoom);
  const minimum = zoomedMinimumSize(zoom, context.workArea);
  window.setMinimumSize(minimum.width, minimum.height);
  if (context.platform === "darwin") {
    window.setWindowButtonPosition({ ...trafficLightPosition(zoom) });
  } else {
    window.setTitleBarOverlay(titleBarOverlay(context.theme, zoom));
  }
}
