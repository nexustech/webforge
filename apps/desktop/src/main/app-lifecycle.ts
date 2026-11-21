import type { App, BrowserWindow } from "electron";
import type { AppFeature } from "./app-feature.js";
import { announceClosedForE2eTests } from "./e2e-closed.js";
import type { createFlushOnClose } from "./flush-on-close.js";
import { log, logFailure } from "./log.js";
import type { PreferencesStore } from "./preferences.js";
import type { createSitePicture } from "./site-picture.js";
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
  /** Pictures of the open site for the Recent list (#1175), once IPC is registered. */
  sitePicture: ReturnType<typeof createSitePicture> | undefined;

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
 * Closes the site, then lets each feature finish its last work (`quit`, A12), then exits, whatever
 * closing does: at most {@link QUIT_CLOSE_WAIT_MS} in all, and a failure is logged, so Webforge never
 * lingers without a window. A site that fails to close still has the features finish, and a feature
 * that fails stops none of the others. `install` comes next, once every feature has finished and
 * only if the site closed in time: it starts a downloaded update's installer (0.5a), which ends a
 * Webforge still running, so nothing may still be writing. `releaseLock` runs then: a launch from
 * then on opens Webforge itself (#413).
 */
export async function closeThenExit(
  steps: {
    close(): Promise<void>;
    readonly features?: readonly Pick<AppFeature, "quit">[];
    /** Last, once the site has closed and every feature has finished; never after the timeout. */
    install?(): void;
    releaseLock(): void;
    exit(code: number): void;
  },
  timers: Timers = defaultTimers,
): Promise<void> {
  const finish = async (feature: Pick<AppFeature, "quit">) => {
    try {
      await feature.quit?.();
    } catch (error) {
      logFailure("Webforge could not finish a feature's work before quitting", error);
    }
  };
  /** Whether the site closed: false if closing it failed. */
  const closing = async (): Promise<boolean> => {
    let closed = true;
    try {
      await steps.close();
    } catch (error) {
      closed = false;
      logFailure("Webforge could not close the site", error);
    }
    await Promise.all((steps.features ?? []).map(finish));
    return closed;
  };
  let timer: unknown;
  try {
    const timedOut = new Promise<"timed-out">((resolve) => {
      timer = timers.setTimeout(() => resolve("timed-out"), QUIT_CLOSE_WAIT_MS);
    });
    const outcome = await Promise.race([closing(), timedOut]);
    if (outcome === "timed-out") {
      log.error("Webforge quit before the site had closed");
    } else if (outcome) {
      try {
        steps.install?.();
      } catch (error) {
        logFailure("Webforge could not install an update", error);
      }
    }
  } finally {
    timers.clearTimeout(timer);
    steps.releaseLock();
    steps.exit(0);
  }
}

/** What quitting closes and finishes (#985). */
export type QuittingDeps = {
  readonly app: Pick<App, "on" | "quit" | "exit" | "releaseSingleInstanceLock" | "isPackaged">;
  readonly lifecycle: Pick<AppLifecycle, "quitting" | "exiting" | "preferences">;
  /** Whether this launch holds the single-instance lock: a second launch quits as well. */
  readonly primaryInstance: boolean;
  /** Copied elements' images, kept in the user's data while the clipboard holds them (R13d). */
  readonly elementClipboard: { forgetKept(): void };
  /** An AI app's key, copied (4.9). */
  readonly secretClipboard: { clearIfHeld(): Promise<void> };
  /** AI apps' MCP server. */
  readonly aiApps: { close(): Promise<void> };
  readonly session: { close(): Promise<void> };
  readonly features: readonly Pick<AppFeature, "quit">[];
  /** Starts a downloaded update's installer (0.5a), if there is one. */
  readonly install: () => void;
};

/**
 * Quitting (#985): Webforge quits when its window closes, then closes the site, lets each feature
 * finish, installs a downloaded update and exits ({@link closeThenExit}).
 */
export function handleQuitting(deps: QuittingDeps): void {
  const { app, lifecycle, primaryInstance } = deps;
  app.on("before-quit", () => {
    lifecycle.quitting = true;
  });

  // Closing the site waits for work on its file (at most a few seconds, R13b), so quitting waits
  // for that, then exits. Not `app.quit()` again: once "will-quit" was held back, Electron ignores
  // it, and every window is closed by now anyway.
  app.on("will-quit", (event) => {
    event.preventDefault();
    if (lifecycle.exiting) return;
    lifecycle.exiting = true;
    // No site's images stay on disk outside it once Webforge has quit (R13d). Not a second launch's
    // quit: the images are the running Webforge's, in the same user data.
    if (primaryInstance) deps.elementClipboard.forgetKept();
    void closeThenExit({
      // The MCP server first: no AI app's request reaches a site that is closing.
      close: async () => {
        // No AI app's key stays on the clipboard after Webforge has quit (4.9).
        await deps.secretClipboard
          .clearIfHeld()
          .catch((error: unknown) => logFailure("secret clipboard clear", error));
        await deps.aiApps.close();
        await deps.session.close();
      },
      // Then each feature's last work, such as My themes' and the Recent list's last writes, and
      // the preferences' last writes: a panel resized just before quitting keeps its size (#740).
      features: [...deps.features, { quit: async () => await lifecycle.preferences?.idle() }],
      // Last, once all of that has finished: a downloaded update's installer (0.5a), which ends a
      // Webforge still running.
      install: deps.install,
      // The site is saved and closed: a launch from now on opens Webforge itself, rather than
      // handing its site to this one, which on a busy computer can take up to a minute more to
      // end (#413).
      releaseLock: () => {
        if (primaryInstance) app.releaseSingleInstanceLock();
      },
      exit: (code) => {
        // Closed: what's left is Electron's teardown, which the E2E tests needn't wait for (#534).
        announceClosedForE2eTests(app.isPackaged);
        app.exit(code);
      },
    });
  });

  // Webforge quits when its window closes, on macOS too (spec/02 §1, #287): it's a one-window
  // app, and one left in the Dock with no window looks broken to the people it's for.
  app.on("window-all-closed", () => {
    app.quit();
  });
}
