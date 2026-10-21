import type { RecentSites } from "./recent-sites.js";

/** Options of {@link createSiteSwitch}. */
export type SiteSwitchOptions = {
  /** The open site's file, if any. */
  readonly currentPath: () => string | undefined;
  /** Asks the renderer to save its last changes (`app:flush`). */
  readonly requestFlush: () => Promise<void>;
  /** A JPEG of the canvas, or `undefined` if there is no window to capture. */
  readonly capture: () => Promise<Uint8Array | undefined>;
  readonly recent: Pick<RecentSites, "saveThumbnail">;
};

/**
 * What happens to the open site before another replaces it or the window closes (1.8): the
 * renderer saves its last changes, then the canvas is captured as the site's thumbnail on the
 * start screen's Recent list. A failed capture never stops the switch.
 */
export function createSiteSwitch(options: SiteSwitchOptions) {
  return {
    /** Saves the open site and captures its thumbnail; does nothing without an open site. */
    async leaveSite(): Promise<void> {
      const path = options.currentPath();
      if (path === undefined) {
        return;
      }
      await options.requestFlush();
      try {
        const jpeg = await options.capture();
        if (jpeg !== undefined) {
          options.recent.saveThumbnail(path, jpeg);
        }
      } catch {
        // The thumbnail is a nicety; the Recent list shows the site without one.
      }
    },
  };
}
