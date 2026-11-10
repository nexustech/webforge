import type { BrowserWindowConstructorOptions, TitleBarOverlayOptions } from "electron";
import { TITLE_BAR_HEIGHT } from "../shared/title-bar.js";

/** The editor themes (UI1); the renderer sets the same name as `data-theme`. */
export type EditorTheme = "dark" | "light";

/**
 * The editor page's address with the person's theme as its query (`?theme=light`), as the Help
 * window's page has it: the page's start-up screen (index.html, public/startup-theme.js) is drawn
 * in that theme from the first paint, before the editor's scripts have loaded.
 */
export function editorPageAddress(pageUrl: string, theme: EditorTheme): string {
  const url = new URL(pageUrl);
  url.searchParams.set("theme", theme);
  return url.href;
}

/** The window's colour before the page paints: each theme's `--background` token. */
export function windowBackground(theme: EditorTheme): string {
  return theme === "dark" ? "#2c3134" : "#edf0f4";
}

/**
 * The native window controls' colours: the title bar's `--titlebar` and `--foreground` tokens
 * (packages/editor-ui/src/theme.css), so Windows and Linux draw them on the same background.
 */
export function titleBarOverlay(theme: EditorTheme, zoom = 1): TitleBarOverlayOptions {
  const height = titleBarHeight(zoom);
  return theme === "dark"
    ? { color: "#3b4248", symbolColor: "#ffffff", height }
    : { color: "#d4d8de", symbolColor: "#26292b", height };
}

/**
 * The title bar's height on screen at the interface zoom `zoom`: the page draws it 40 px high in
 * its own pixels, which the zoom scales, so the native controls beside it are scaled to match.
 */
const titleBarHeight = (zoom: number) => Math.round(TITLE_BAR_HEIGHT * zoom);

/** The traffic lights' height on macOS, in screen pixels: 12 px from the top centres them at 100%. */
const TRAFFIC_LIGHTS_HEIGHT = 16;

/** Where macOS's traffic lights sit, centred in the title bar at the interface zoom `zoom`. */
export function trafficLightPosition(zoom = 1): { readonly x: number; readonly y: number } {
  return { x: 12, y: Math.round((titleBarHeight(zoom) - TRAFFIC_LIGHTS_HEIGHT) / 2) };
}

/**
 * The frameless window (1.2): the renderer draws the title bar, Electron draws only the native
 * controls over it, so no window-control IPC is needed. On macOS the traffic lights sit centred
 * in the 40 px bar; elsewhere the controls take the title bar's colours. `titleBarOverlay` also
 * gives the page the Window Controls Overlay area (`env(titlebar-area-*)`) to lay out around them.
 */
export function titleBarOptions(
  platform: NodeJS.Platform,
  theme: EditorTheme,
  zoom = 1,
): Pick<
  BrowserWindowConstructorOptions,
  "titleBarStyle" | "titleBarOverlay" | "trafficLightPosition"
> {
  if (platform === "darwin") {
    return {
      titleBarStyle: "hidden",
      titleBarOverlay: true,
      trafficLightPosition: trafficLightPosition(zoom),
    };
  }
  return { titleBarStyle: "hidden", titleBarOverlay: titleBarOverlay(theme, zoom) };
}

/** The main window's size the first time, and whenever it isn't maximised and nothing is saved. */
const DEFAULT_WINDOW_SIZE = { width: 1280, height: 800 } as const;

/** The smallest the main window may be. */
const MIN_WINDOW_SIZE = { width: 960, height: 600 } as const;

/**
 * The main window's smallest size at the interface zoom `zoom`: {@link MIN_WINDOW_SIZE} of the
 * page's own pixels, so the editor keeps the room it is laid out for when zoomed in, but never
 * bigger than the screen it is on (`workArea`). Zoomed out, it stays {@link MIN_WINDOW_SIZE}.
 */
export function zoomedMinimumSize(
  zoom: number,
  workArea: { readonly width: number; readonly height: number },
): { readonly width: number; readonly height: number } {
  const scale = Math.max(1, zoom);
  const size = (min: number, screen: number) =>
    Math.max(min, Math.min(Math.round(min * scale), screen));
  return {
    width: size(MIN_WINDOW_SIZE.width, workArea.width),
    height: size(MIN_WINDOW_SIZE.height, workArea.height),
  };
}

/** A rectangle in screen pixels: a window's bounds or a display's work area. */
type Box = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/** How much of a window must be on a screen to count as visible: enough to grab its title bar. */
const VISIBLE = { width: 120, height: TITLE_BAR_HEIGHT } as const;

/** Where and how the main window opens; see {@link mainWindowPlacement}. */
export type WindowPlacement = {
  readonly bounds: { readonly width: number; readonly height: number; x?: number; y?: number };
  readonly maximized: boolean;
};

/** Whether `a` and `b` overlap by at least the {@link VISIBLE} area. */
function overlaps(a: Box, b: Box): boolean {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return width >= VISIBLE.width && height >= VISIBLE.height;
}

/**
 * Where the main window opens (ADR 0008): maximised the first time, so the canvas gets the room;
 * after that as the person left it. Saved bounds are used only while they are on one of the
 * screens (`workAreas`), so a window left on a disconnected monitor comes back centred instead.
 */
export function mainWindowPlacement(
  saved: { readonly maximized: boolean; readonly bounds: Box } | null,
  workAreas: readonly Box[],
): WindowPlacement {
  if (saved === null) {
    return { bounds: { ...DEFAULT_WINDOW_SIZE }, maximized: true };
  }
  // No bigger than the largest screen, e.g. after undocking from a large monitor.
  const fit = (size: number, min: number, screens: readonly number[]) =>
    Math.max(min, screens.length === 0 ? size : Math.min(size, Math.max(...screens)));
  const width = fit(
    saved.bounds.width,
    MIN_WINDOW_SIZE.width,
    workAreas.map((area) => area.width),
  );
  const height = fit(
    saved.bounds.height,
    MIN_WINDOW_SIZE.height,
    workAreas.map((area) => area.height),
  );
  const onScreen = workAreas.some((area) => overlaps({ ...saved.bounds, width, height }, area));
  return {
    bounds: onScreen ? { x: saved.bounds.x, y: saved.bounds.y, width, height } : { width, height },
    maximized: saved.maximized,
  };
}
