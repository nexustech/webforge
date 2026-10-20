import type { ProjectStore } from "@webforge/storage";
import type { Backups } from "./backups.js";

/** How often an edited site is backed up again (1.7: every 30 min while editing). */
const INTERVAL_MS = 30 * 60 * 1_000;

/** Timers, injectable so tests can use fake ones. */
type Timers = {
  setInterval(callback: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
};

/**
 * When to take backups: once when a site opens, then every 30 minutes if it was saved since the
 * last one. A site that is only looked at gets one backup per opening.
 */
export function createBackupSchedule(
  backups: Pick<Backups, "take">,
  options: { readonly intervalMs?: number; readonly timers?: Timers } = {},
) {
  const timers: Timers = options.timers ?? {
    setInterval: (callback, ms) => globalThis.setInterval(callback, ms),
    clearInterval: (handle) => globalThis.clearInterval(handle as ReturnType<typeof setInterval>),
  };
  let open: { store: ProjectStore; path: string } | undefined;
  let edited = false;
  let interval: unknown;

  const backUp = async () => {
    const current = open;
    if (current === undefined) return;
    edited = false;
    try {
      await backups.take(current.store, current.path);
    } catch (error) {
      // A backup that fails (disk full, site closed meanwhile) never disturbs editing. Only the
      // error's code is logged: never paths or content.
      const code = error instanceof Error && "code" in error ? String(error.code) : "no code";
      console.error(`Webforge could not back up the site (${code})`);
    }
  };

  const stop = () => {
    if (interval !== undefined) timers.clearInterval(interval);
    interval = undefined;
    open = undefined;
  };

  return {
    /** A site was opened (or created): back it up now and start the 30-minute rhythm. */
    opened(store: ProjectStore, path: string): Promise<void> {
      stop();
      open = { store, path };
      interval = timers.setInterval(() => {
        if (edited) void backUp();
      }, options.intervalMs ?? INTERVAL_MS);
      return backUp();
    },
    /** The open site was saved. */
    committed(): void {
      edited = true;
    },
    /** The site was closed; no more backups of it. */
    closed: stop,
  };
}
