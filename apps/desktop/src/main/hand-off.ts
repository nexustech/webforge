import type { BrowserWindow, Dialog } from "electron";
import type { ProjectFailureReason, ProjectResult } from "../shared/ipc-contract.js";
import { openFailureMessage } from "../shared/open-failure.js";
import type { AppLifecycle } from "./app-lifecycle.js";
import type { PreferencesStore } from "./preferences.js";
import { samePath } from "./site-paths.js";

/** Options of {@link createHandOff}. */
export type HandOffOptions = {
  /** The open site's file, if any. */
  readonly currentPath: () => string | undefined;
  /** Saves the open site and captures its Recent thumbnail (see `createSiteSwitch`). */
  readonly leaveSite: () => Promise<void>;
  /** Opens the site, offering its backups if it is damaged. */
  readonly open: (path: string) => Promise<ProjectResult>;
  /** Brings the window to the front, if there is one, while the site is saved and opened. */
  readonly focus: () => void;
  /**
   * Brings the window to the front, or opens one if there is none; `reload` starts an open
   * window over with the newly opened site, as the renderer does after its own Open.
   */
  readonly show: (reload: boolean) => void;
  /** Tells the user why the site didn't open; the site that was open stays open. */
  readonly failed: (reason: ProjectFailureReason) => Promise<void>;
};

/**
 * Sites handed to the running app (1.8, P1): a `.wforge` double-clicked while Webforge is open
 * starts a second instance, which passes its command line here and quits; macOS sends
 * `open-file` instead. The open site is saved first, then the new one replaces it in the same
 * window. Hand-offs run one at a time, in the order they arrive, so two quick double-clicks
 * never open sites over each other.
 */
export function createHandOff(options: HandOffOptions) {
  let queue = Promise.resolve();

  const run = async (path: string | undefined) => {
    const current = options.currentPath();
    if (path === undefined || (current !== undefined && samePath(current, path))) {
      options.show(false);
      return;
    }
    // Only focus here: a window opened now would load the old site and need a reload at once.
    options.focus();
    await options.leaveSite();
    const result = await options.open(path);
    if (result.status === "opened") {
      options.show(true);
    } else if (result.status === "failed") {
      await options.failed(result.reason);
    }
  };

  return {
    /** Opens `path` in the running window, or just shows the window when there is none. */
    open(path: string | undefined): Promise<void> {
      // A failed hand-off never blocks the next one; `failed` has told the user what it could.
      queue = queue.then(() => run(path)).catch(() => undefined);
      return queue;
    },
  };
}

/** What a hand-off shows in (#985): the editor's window, opened again if it was closed. */
export type HandOffWindowDeps = {
  readonly lifecycle: Pick<
    AppLifecycle<BrowserWindow>,
    "quitting" | "preferences" | "mainWindow" | "focusMainWindow"
  >;
  /** Opens the editor's window, which loads the site that is open now. */
  readonly openWindow: (preferences: PreferencesStore) => void;
  readonly dialog: Pick<Dialog, "showMessageBox">;
};

/** The window's part of a hand-off: {@link HandOffOptions}' `focus`, `show` and `failed`. */
export function handOffWindow(
  deps: HandOffWindowDeps,
): Pick<HandOffOptions, "focus" | "show" | "failed"> {
  const { lifecycle } = deps;
  return {
    focus: () => {
      lifecycle.focusMainWindow();
    },
    show: (reload) => {
      // A hand-off that finishes while the app quits must not bring a window back.
      if (lifecycle.quitting) return;
      const window = lifecycle.focusMainWindow();
      if (window === undefined) {
        // A new window loads the site that is open now.
        if (lifecycle.preferences !== undefined) deps.openWindow(lifecycle.preferences);
      } else if (reload) {
        window.webContents.reload();
      }
    },
    failed: async (reason) => {
      const options = { type: "warning" as const, message: openFailureMessage(reason) };
      const parent = lifecycle.mainWindow();
      await (parent === undefined
        ? deps.dialog.showMessageBox(options)
        : deps.dialog.showMessageBox(parent, options));
    },
  };
}
