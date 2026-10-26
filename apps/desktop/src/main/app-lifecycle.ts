import type { BrowserWindow } from "electron";
import type { createFlushOnClose } from "./flush-on-close.js";
import { log, logFailure } from "./log.js";
import type { PreferencesStore } from "./preferences.js";
import { defaultTimers, type Timers } from "./timers.js";

/** The parts of a window the lifecycle brings forward; a fake in tests. */
type MainWindow = Pick<BrowserWindow, "isMinimized" | "restore" | "show" | "focus">;

/**
 * What the app knows about itself as it runs, which its event handlers share: whether it is
 * quitting, a site macOS handed it before it was ready, the preferences once read, and its one
 * window (R13c: in one object, instead of flags the handlers closed over).
 */
export class AppLifecycle<W extends MainWindow = BrowserWindow> {
  /**
   * Set once the user quits, so a window that held its close back for a last save quits the app
   * afterwards (macOS keeps the app running when its last window closes).
   */
  quitting = false;
  /** Set once quitting has begun to close the site and exit, so it happens once. */
  exiting = false;
  /** A site double-clicked in Finder (P1) before the app was ready, to open once it is. */
  projectFromFinder: string | undefined;
  /** The preferences, once read; a window can't be created before. */
  preferences: PreferencesStore | undefined;
  /** Saves the renderer's last changes before its window closes (P2), once registered. */
  flushOnClose: ReturnType<typeof createFlushOnClose> | undefined;

  readonly #windows: () => readonly W[];

  /** `windows` lists the app's windows (`BrowserWindow.getAllWindows`). */
  constructor(windows: () => readonly W[]) {
    this.#windows = windows;
  }

  /** The app's one window, or `undefined` while there is none (macOS, after closing it). */
  mainWindow(): W | undefined {
    return this.#windows()[0];
  }

  /** Brings the window to the front; `undefined` if there is none. */
  focusMainWindow(): W | undefined {
    const window = this.mainWindow();
    if (window !== undefined) {
      if (window.isMinimized()) window.restore();
      window.show();
      window.focus();
    }
    return window;
  }
}

/** How long quitting waits for the site to close before it exits anyway. */
const QUIT_CLOSE_WAIT_MS = 10_000;

/**
 * Closes the site, then exits, whatever closing does: at most {@link QUIT_CLOSE_WAIT_MS}, and a
 * failure is logged, so Webforge never lingers without a window. `releaseLock` runs first, once
 * the site is closed: a launch from then on opens Webforge itself (#413).
 */
export async function closeThenExit(
  steps: {
    close(): Promise<void>;
    releaseLock(): void;
    exit(code: number): void;
  },
  timers: Timers = defaultTimers,
): Promise<void> {
  let timer: unknown;
  try {
    const timedOut = new Promise<"timed-out">((resolve) => {
      timer = timers.setTimeout(() => resolve("timed-out"), QUIT_CLOSE_WAIT_MS);
    });
    if ((await Promise.race([steps.close(), timedOut])) === "timed-out") {
      log.error("Webforge quit before the site had closed");
    }
  } catch (error) {
    logFailure("Webforge could not close the site", error);
  } finally {
    timers.clearTimeout(timer);
    steps.releaseLock();
    steps.exit(0);
  }
}
