import { log } from "./log.js";

// A start-up's stages in the main process (#891, architecture §10's cold start): each one is a
// `performance.mark`, and a perf build logs them in one line once the window is created, by name
// and time only. `e2e/perf/cold-start.perf.ts` reads that line, and the editor's own marks, for
// each launch.

/** The main process's stages of a start-up, in the order they happen. */
type StartupStage =
  /** The entry module's first line: its whole import graph has loaded. */
  | "main-entry"
  /** Electron's `ready`. */
  | "ready"
  /** Every IPC handler registered, before the window can ask for anything. */
  | "ipc-registered"
  /** A double-clicked site opened (only when there is one). */
  | "site-opened"
  /** The editor's window created, its page starting to load. */
  | "window-created";

/** What every start-up mark's name starts with, so other marks are left out. */
const PREFIX = "webforge:";

/** Marks `stage` now, in the main process's performance timeline. */
export function markStartup(stage: StartupStage): void {
  performance.mark(`${PREFIX}${stage}`);
}

/** `ms` to a tenth of a millisecond. */
const tenths = (ms: number) => Math.round(ms * 10) / 10;

/**
 * When the process started (`origin`, in ms since the epoch, which the editor's timings can be
 * set against) and each stage marked so far, in ms after that.
 */
export function startupTimes(): Record<string, number> {
  const times: Record<string, number> = { origin: tenths(performance.timeOrigin) };
  for (const mark of performance.getEntriesByType("mark")) {
    if (mark.name.startsWith(PREFIX))
      times[mark.name.slice(PREFIX.length)] = tenths(mark.startTime);
  }
  return times;
}

/**
 * Logs the start-up's stages, in a build of `mode` "perf" only (`electron-vite build --mode perf`):
 * `Webforge start-up (origin=…, main-entry=…, ready=…, …)`, which the perf check looks for.
 */
export function logStartupTimes(mode: string): void {
  if (mode !== "perf") return;
  log.info("Webforge start-up", startupTimes());
}
