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
