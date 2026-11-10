import type { Rectangle, TitleBarOverlayOptions } from "electron";
import {
  type EditorTheme,
  titleBarOverlay,
  trafficLightPosition,
  zoomedMinimumSize,
} from "./window-options.js";

/** The parts of a `BrowserWindow` the interface zoom's smallest size changes. */
export type SizedWindow = {
  getBounds(): Rectangle;
  setBounds(bounds: Rectangle): void;
  setMinimumSize(width: number, height: number): void;
  isMaximized(): boolean;
  isFullScreen(): boolean;
};

/** The parts of a `BrowserWindow` the interface zoom changes. */
export type ZoomableWindow = SizedWindow & {
  readonly webContents: { setZoomFactor(factor: number): void };
  setTitleBarOverlay(options: TitleBarOverlayOptions): void;
  setWindowButtonPosition(position: { x: number; y: number } | null): void;
};

/**
 * Gives the editor's window its smallest size at the interface zoom `zoom` (`zoomedMinimumSize`),
 * capped by the screen it is on (`workArea`), and grows it to that size if it is smaller: a raised
 * minimum alone leaves an open window as it is. A grown window stays on its screen. A maximised or
 * full-screen window already fills the screen, so only its minimum changes.
 */
export function fitWindowToZoom(window: SizedWindow, zoom: number, workArea: Rectangle): void {
  const minimum = zoomedMinimumSize(zoom, workArea);
  window.setMinimumSize(minimum.width, minimum.height);
  if (window.isMaximized() || window.isFullScreen()) return;
  const bounds = window.getBounds();
  const width = Math.max(bounds.width, minimum.width);
  const height = Math.max(bounds.height, minimum.height);
  if (width === bounds.width && height === bounds.height) return;
  const place = (at: number, size: number, start: number, room: number) =>
    Math.max(start, Math.min(at, start + room - size));
  window.setBounds({
    x: place(bounds.x, width, workArea.x, workArea.width),
    y: place(bounds.y, height, workArea.y, workArea.height),
    width,
    height,
  });
}

/**
 * Zooms the editor's window to `zoom` (View › Zoom In Interface): its page, with the canvas inside
 * it, and the native title bar's controls to the page's scaled title bar. Its smallest size grows
 * with it ({@link fitWindowToZoom}), capped by the screen it is on (`workArea`), so the editor
 * keeps the room it is laid out for. The exported site is never touched: only this window's scale
 * changes.
 */
export function applyInterfaceZoom(
  window: ZoomableWindow,
  zoom: number,
  context: {
    readonly platform: NodeJS.Platform;
    readonly theme: EditorTheme;
    /** The work area of the screen the window is on. */
    readonly workArea: Rectangle;
  },
): void {
  window.webContents.setZoomFactor(zoom);
  fitWindowToZoom(window, zoom, context.workArea);
  if (context.platform === "darwin") {
    window.setWindowButtonPosition({ ...trafficLightPosition(zoom) });
  } else {
    window.setTitleBarOverlay(titleBarOverlay(context.theme, zoom));
  }
}
