import type { RecentSites } from "./recent-sites.js";

/** How long the thumbnail may take; a hung renderer never answers, and the switch goes on. */
const CAPTURE_TIMEOUT_MS = 3_000;

/** Options of {@link createSiteSwitch}. */
export type SiteSwitchOptions = {
  /** The open site's file, if any. */
  readonly currentPath: () => string | undefined;
  /** Asks the renderer to save its last changes (`app:flush`). */
  readonly requestFlush: () => Promise<void>;
  /** A JPEG of the canvas, or `undefined` if there is no window to capture. */
  readonly capture: () => Promise<Uint8Array | undefined>;
  readonly recent: Pick<RecentSites, "saveThumbnail">;
  readonly captureTimeoutMs?: number;
};

/**
 * What happens to the open site before another replaces it or the window closes (1.8): the
 * renderer saves its last changes, then the canvas is captured as the site's thumbnail on the
 * start screen's Recent list. A failed or hung capture never stops the switch.
 */
export function createSiteSwitch(options: SiteSwitchOptions) {
  const timeoutMs = options.captureTimeoutMs ?? CAPTURE_TIMEOUT_MS;
  const captureInTime = async (): Promise<Uint8Array | undefined> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<undefined>((resolve) => {
      timer = setTimeout(() => resolve(undefined), timeoutMs);
    });
    try {
      return await Promise.race([options.capture(), late]);
    } finally {
      clearTimeout(timer);
    }
  };
  return {
    /** Saves the open site and captures its thumbnail; does nothing without an open site. */
    async leaveSite(): Promise<void> {
      const path = options.currentPath();
      if (path === undefined) {
        return;
      }
      await options.requestFlush();
      try {
        const jpeg = await captureInTime();
        if (jpeg !== undefined) {
          await options.recent.saveThumbnail(path, jpeg);
        }
      } catch {
        // The thumbnail is a nicety; the Recent list shows the site without one.
      }
    },
  };
}
