import type { ProjectFailureReason, ProjectResult } from "../shared/ipc-contract.js";
import { samePath } from "./project-session.js";

/** Options of {@link createHandOff}. */
export type HandOffOptions = {
  /** The open site's file, if any. */
  readonly currentPath: () => string | undefined;
  /** Saves the open site and captures its Recent thumbnail (see `createSiteSwitch`). */
  readonly leaveSite: () => Promise<void>;
  /** Opens the site, offering its backups if it is damaged. */
  readonly open: (path: string) => Promise<ProjectResult>;
  /**
   * Brings the window to the front, or opens one if there is none; `reload` starts it over with
   * the newly opened site, as the renderer does after its own Open.
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
    options.show(false);
    const current = options.currentPath();
    if (path === undefined || (current !== undefined && samePath(current, path))) {
      return;
    }
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
