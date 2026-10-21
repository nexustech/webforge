import type { BrowserWindowConstructorOptions, TitleBarOverlayOptions } from "electron";

/** The editor themes (UI1); the renderer sets the same name as `data-theme`. */
export type EditorTheme = "dark" | "light";

/** The window's colour before the page paints: each theme's `--background` token. */
export function windowBackground(theme: EditorTheme): string {
  return theme === "dark" ? "#2c3134" : "#edf0f4";
}

/** Height of the custom title bar (UI1), so the native controls line up with it. */
export const TITLE_BAR_HEIGHT = 40;

/**
 * The native window controls' colours: the title bar's `--titlebar` and `--foreground` tokens
 * (packages/editor-ui/src/theme.css), so Windows and Linux draw them on the same background.
 */
export function titleBarOverlay(theme: EditorTheme): TitleBarOverlayOptions {
  return theme === "dark"
    ? { color: "#3b4248", symbolColor: "#ffffff", height: TITLE_BAR_HEIGHT }
    : { color: "#d4d8de", symbolColor: "#26292b", height: TITLE_BAR_HEIGHT };
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
): Pick<
  BrowserWindowConstructorOptions,
  "titleBarStyle" | "titleBarOverlay" | "trafficLightPosition"
> {
  if (platform === "darwin") {
    return {
      titleBarStyle: "hidden",
      titleBarOverlay: true,
      trafficLightPosition: { x: 12, y: 12 },
    };
  }
  return { titleBarStyle: "hidden", titleBarOverlay: titleBarOverlay(theme) };
}

/** The main window's size the first time, and whenever it isn't maximised and nothing is saved. */
const DEFAULT_WINDOW_SIZE = { width: 1280, height: 800 } as const;

/** The smallest the main window may be. */
export const MIN_WINDOW_SIZE = { width: 960, height: 600 } as const;

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
