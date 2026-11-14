import { t } from "@webforge/i18n";
import type { BrowserWindow } from "electron";
import type { Preferences } from "../shared/ipc/prefs.js";
import type { HelpWindows } from "./help-window.js";
import { applyInterfaceZoom, fitWindowToZoom } from "./interface-zoom.js";
import { logFailure } from "./log.js";
import type { PreferencesStore } from "./preferences.js";
import { createSecureWebPreferences } from "./security.js";
import { installContextMenu, spellCheckAvailable } from "./spellcheck.js";
import { markStartup } from "./startup-timing.js";
import {
  editorPageAddress,
  MIN_WINDOW_SIZE,
  mainWindowPlacement,
  titleBarOptions,
  titleBarOverlay,
  windowBackground,
} from "./window-options.js";
import { rememberWindowState } from "./window-state.js";

/** What the editor's window is made with (#985): the parts of Electron, and the app's own. */
export type MainWindowDeps = {
  readonly electron: Pick<typeof import("electron"), "BrowserWindow" | "Menu" | "screen">;
  readonly platform: NodeJS.Platform;
  /** The editor's preload script. */
  readonly preload: string;
  /** The editor's page: the app's scheme, or the dev server. */
  readonly appUrl: string;
  readonly helpWindows: Pick<HelpWindows, "is" | "close" | "setTheme">;
  /** Hooks the window's close to the renderer's last save (P2). */
  readonly installFlush: (window: BrowserWindow) => void;
  /** The window came to the front: something copied elsewhere may have replaced the copy (R13d). */
  readonly onFocus: () => void;
};

/** The editor's window: opened, and following the theme and zoom the person chooses. */
export type MainWindows = {
  /** Opens the editor's window, as the person left it, in their theme and at their zoom. */
  open(preferences: PreferencesStore): void;
  /**
   * Starts following `preferences` as they change: every window zooms with the interface zoom, and
   * the editor's window controls take the theme's colours. Returns what to call on each change.
   */
  follow(preferences: Pick<Preferences, "theme" | "interfaceZoom">): (next: Preferences) => void;
};

/** The editor's window (#985), out of `startApp`. */
export function createMainWindows(deps: MainWindowDeps): MainWindows {
  const { electron, platform, helpWindows } = deps;
  const { BrowserWindow, screen } = electron;
  const workAreaOf = (window: BrowserWindow) =>
    screen.getDisplayMatching(window.getBounds()).workArea;
  return {
    open(preferences) {
      const { theme, window: saved, interfaceZoom } = preferences.get();
      const placement = mainWindowPlacement(
        saved,
        screen.getAllDisplays().map((display) => display.workArea),
      );
      const window = new BrowserWindow({
        title: t("app.name"),
        ...placement.bounds,
        minWidth: MIN_WINDOW_SIZE.width,
        minHeight: MIN_WINDOW_SIZE.height,
        // The renderer draws the title bar (1.2), in the person's theme, at the interface zoom.
        ...titleBarOptions(platform, theme, interfaceZoom),
        backgroundColor: windowBackground(theme),
        show: false,
        webPreferences: {
          ...createSecureWebPreferences(deps.preload, spellCheckAvailable(platform)),
          // The interface zoom (View › Zoom In Interface) from the first paint.
          zoomFactor: interfaceZoom,
        },
      });
      // Before its page starts loading (#891); only the first window's is logged.
      markStartup("window-created");
      // Zoomed in, the smallest window grows, capped by the screen the window opens on.
      fitWindowToZoom(window, interfaceZoom, workAreaOf(window));
      // Spelling suggestions, Add to Dictionary, Cut, Copy and Paste on right-clicks (F-ED-19).
      installContextMenu(window, (template) => electron.Menu.buildFromTemplate(template));
      // Maximised the first time, so the canvas gets the room (ADR 0008). Maximising shows the
      // window at once, in the theme's background colour; the editor then lays out at its final
      // size, instead of at 1280 × 800 and again when the window grows.
      if (placement.maximized) window.maximize();
      window.once("ready-to-show", () => {
        window.show();
      });
      rememberWindowState(window, preferences);
      window.on("focus", deps.onFocus);
      // Autosave writes the last changes before the window closes (P2).
      deps.installFlush(window);
      // Help goes with the editor, so the app quits with it (5.4b).
      window.on("closed", () => helpWindows.close());
      // In the person's theme from the first paint: the page's start-up screen reads it (#887).
      // A failed or aborted load (e.g. a reload while loading) is not fatal; the window stays open.
      window.loadURL(editorPageAddress(deps.appUrl, theme)).catch((error: unknown) => {
        logFailure("Webforge could not load the editor window", error);
      });
    },
    follow(initial) {
      let windowTheme = initial.theme;
      let windowZoom = initial.interfaceZoom;
      return ({ theme, interfaceZoom }) => {
        if (interfaceZoom !== windowZoom) {
          windowZoom = interfaceZoom;
          // Every window of the app zooms (View › Zoom In Interface): Help's page only, as it has
          // the system's own title bar.
          for (const window of BrowserWindow.getAllWindows()) {
            if (helpWindows.is(window)) window.webContents.setZoomFactor(interfaceZoom);
            else {
              applyInterfaceZoom(window, interfaceZoom, {
                platform,
                theme,
                workArea: workAreaOf(window),
              });
            }
          }
        }
        if (theme === windowTheme) return;
        windowTheme = theme;
        // The native window controls follow the theme (macOS's traffic lights need nothing). The
        // Help window has the system's own title bar, and follows the theme in its page.
        for (const window of BrowserWindow.getAllWindows()) {
          if (helpWindows.is(window)) continue;
          window.setBackgroundColor(windowBackground(theme));
          if (platform !== "darwin")
            window.setTitleBarOverlay(titleBarOverlay(theme, interfaceZoom));
        }
        helpWindows.setTheme(theme);
      };
    },
  };
}
