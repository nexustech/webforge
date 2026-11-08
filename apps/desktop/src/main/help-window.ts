import type { BrowserWindow, BrowserWindowConstructorOptions } from "electron";
import { type HelpTarget, helpEvents } from "../shared/ipc/help.js";
import { createSecureWebPreferences, hardenWebContents, isAppUrl } from "./security.js";

/** The parts of a `BrowserWindow` the Help window uses; a fake in tests. */
export type HelpBrowserWindow = Pick<
  BrowserWindow,
  | "show"
  | "focus"
  | "restore"
  | "isMinimized"
  | "isDestroyed"
  | "close"
  | "once"
  | "on"
  | "loadURL"
  | "setBackgroundColor"
> & {
  readonly webContents: Pick<
    BrowserWindow["webContents"],
    "send" | "setWindowOpenHandler" | "on" | "isLoading"
  >;
};

/** The editor's look, which the Help window follows. */
type Theme = "dark" | "light";

/** What the Help window is made from. */
export type HelpWindowOptions = {
  /** Makes a window: `new BrowserWindow(options)`. */
  readonly create: (options: BrowserWindowConstructorOptions) => HelpBrowserWindow;
  /** The Help page's address: `help.html` beside the editor's, or the dev server's. */
  readonly pageUrl: string;
  /** The Help window's own preload script (`preload/help.cjs`). */
  readonly preload: string;
  /** Its title: "{appName} Help". */
  readonly title: string;
  /** The editor's look now. */
  readonly theme: () => Theme;
  /** The window's background in `theme`, as the editor's, so it never flashes white. */
  readonly background: (theme: Theme) => string;
  /** Logs a failed load, by the error's kind only. */
  readonly onLoadFailed: (error: unknown) => void;
};

/** The Help window (5.4b, HP-10): one at most, beside the editor. */
export type HelpWindows = {
  /**
   * Opens the Help window at `target`, or, when it's open, brings it to the front and shows
   * `target` there. Always at the person's asking (F1, a menu, a **?**), so it takes the focus.
   */
  open(target: HelpTarget): void;
  /** Follows the editor's look. */
  setTheme(theme: Theme): void;
  /** Closes it, if it's open: as the editor's window closes. */
  close(): void;
  /** Whether `window` is the Help window, which isn't the editor's. */
  is(window: unknown): boolean;
  /** Whether `url` is the Help page: what the Help window's own IPC calls must come from. */
  isHelpPage(url: string): boolean;
};

/** The Help page's address with what it shows first and the look, as its query (no load race). */
export function helpPageAddress(pageUrl: string, target: HelpTarget, theme: Theme): string {
  const url = new URL(pageUrl);
  if (target.page !== undefined) url.searchParams.set("page", target.page);
  if (target.anchor !== undefined) url.searchParams.set("anchor", target.anchor);
  url.searchParams.set("theme", theme);
  return url.href;
}

/**
 * Whether `url` is the Help page at `pageUrl`: the same path on the app's own scheme and host, or
 * on the dev server (S33). The editor's page never is, though it has the same origin.
 */
export function isHelpPageUrl(url: string, pageUrl: string): boolean {
  if (!isAppUrl(url, pageUrl)) return false;
  try {
    return new URL(url).pathname === new URL(pageUrl).pathname;
  } catch {
    return false;
  }
}

/**
 * The Help window (5.4b, HP-10): a window of its own beside the editor, so the person can read and
 * work at once. Secured as the editor's is: isolated and sandboxed, with its own preload, which
 * gives its page only `window.webforgeHelp`, no pop-ups, and no navigating away from its page. Its
 * page comes with the app; a link to the web opens in the browser.
 */
export function createHelpWindows(options: HelpWindowOptions): HelpWindows {
  let window: HelpBrowserWindow | undefined;
  const isHelpPage = (url: string) => isHelpPageUrl(url, options.pageUrl);
  const isOpen = (): HelpBrowserWindow | undefined =>
    window !== undefined && !window.isDestroyed() ? window : undefined;

  const create = (target: HelpTarget) => {
    const theme = options.theme();
    const created = options.create({
      title: options.title,
      width: 960,
      height: 760,
      minWidth: 520,
      minHeight: 420,
      backgroundColor: options.background(theme),
      autoHideMenuBar: true,
      show: false,
      webPreferences: createSecureWebPreferences(options.preload),
    });
    hardenWebContents(created.webContents, options.pageUrl);
    // Only the Help page itself: on the dev server, the editor's page has the same origin.
    created.webContents.on("will-navigate", (event, url) => {
      if (!isHelpPage(url)) event.preventDefault();
    });
    created.once("ready-to-show", () => {
      created.show();
      created.focus();
    });
    created.on("closed", () => {
      if (window === created) window = undefined;
    });
    window = created;
    created.loadURL(helpPageAddress(options.pageUrl, target, theme)).catch(options.onLoadFailed);
  };

  return {
    open(target) {
      const open = isOpen();
      if (open === undefined) {
        create(target);
        return;
      }
      // Still loading, its page reads where to start from its address and would miss the
      // message: load it again at the new place instead.
      if (open.webContents.isLoading()) {
        open
          .loadURL(helpPageAddress(options.pageUrl, target, options.theme()))
          .catch(options.onLoadFailed);
      } else {
        open.webContents.send(helpEvents.show.channel, target);
      }
      if (open.isMinimized()) open.restore();
      open.show();
      open.focus();
    },
    setTheme(theme) {
      const open = isOpen();
      if (open === undefined) return;
      open.setBackgroundColor(options.background(theme));
      open.webContents.send(helpEvents.theme.channel, theme);
    },
    close() {
      isOpen()?.close();
    },
    is: (candidate) => candidate !== undefined && candidate === window,
    isHelpPage,
  };
}
