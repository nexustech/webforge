import { errorDetailsOf, type WorkerCrash } from "../shared/error-details.js";

/** The parts of Node's `process` the handlers listen to; a fake in tests. */
export type WorkerProcessEvents = {
  on(
    event: "uncaughtException" | "unhandledRejection",
    listener: (error: unknown) => void,
  ): unknown;
};

/** How long a crashed worker waits for its message to reach the main process before it exits. */
export const CRASH_EXIT_DELAY_MS = 100;

/**
 * Tells the main process when an error nothing caught ends this worker (R3): `post` sends the
 * error's name and stack frames (never its message), which the main process writes into a local
 * crash report, and then the worker exits, as it is in an unknown state. Whoever ran the job takes
 * the exit as a failed job. Only the first error is told.
 */
export function installWorkerCrashHandlers(
  events: WorkerProcessEvents,
  post: (crash: WorkerCrash) => void,
  exit: () => void,
  later: (run: () => void, ms: number) => unknown = setTimeout,
): void {
  let crashed = false;
  const crash = (kind: WorkerCrash["kind"]) => (error: unknown) => {
    if (crashed) return;
    crashed = true;
    try {
      post({ type: "crashed", kind, error: errorDetailsOf(error) });
    } finally {
      later(exit, CRASH_EXIT_DELAY_MS);
    }
  };
  events.on("uncaughtException", crash("uncaught-exception"));
  events.on("unhandledRejection", crash("unhandled-rejection"));
}
