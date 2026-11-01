import {
  type ExportJob,
  type ExportOutcome,
  exportOutcomeSchema,
} from "../shared/export-worker-protocol.js";
import type { ExportProgress } from "../shared/ipc/site.js";
import { createWorkerChannel, type ReadMedia } from "./worker-channel.js";
import type { WorkerProcess } from "./worker-process.js";

/** How long an export may take before the worker is stopped (large sites encode many images). */
const EXPORT_TIMEOUT_MS = 10 * 60_000;

/** What the export worker can ask of the main process during one export, and how it's cancelled. */
export type ExportOptions = {
  /**
   * The bytes and type the open site stores under a hash, for the image or document the build has
   * reached (R15): read one at a time, as the worker asks, so main never holds them all.
   */
  readonly readMedia: ReadMedia;
  /** Cancels the export: the worker stops before its next image or page and writes nothing. */
  readonly signal?: AbortSignal | undefined;
  /** Told how far the export has come, as the worker reaches each stage (3.1). */
  readonly onProgress?: ((progress: ExportProgress) => void) | undefined;
};

/** Runs exports of the open site in one utility process; see {@link createExportRunner}. */
export type ExportRunner = {
  /** Runs `job` once the exports before it are done, and resolves with its validated outcome. */
  run(job: ExportJob, options: ExportOptions): Promise<ExportOutcome>;
  /** Stops the worker, and its images cached in memory go with it: the site is closing (R15). */
  close(): void;
};

/**
 * Runs exports in a utility process kept while the site is open, so the images it encoded stay
 * cached in its memory for the next export (R15), and nothing about them is kept on disk. Exports
 * run one at a time, through a {@link createWorkerChannel}. A worker that exits, answers with
 * anything unexpected or takes longer than `timeoutMs` (e.g. a codec stuck on a corrupt image)
 * fails that export and is replaced for the next, so the main process never trusts its messages
 * blindly and an export never hangs forever.
 */
export function createExportRunner(
  startWorker: () => WorkerProcess,
  timeoutMs = EXPORT_TIMEOUT_MS,
): ExportRunner {
  const channel = createWorkerChannel(startWorker);
  let queue: Promise<unknown> = Promise.resolve();

  const runOne = async (job: ExportJob, options: ExportOptions): Promise<ExportOutcome> => {
    const result = await channel.run(job, {
      outcome: exportOutcomeSchema,
      timeoutMs,
      signal: options.signal,
      onProgress: options.onProgress,
      readMedia: options.readMedia,
    });
    return result.ok
      ? result.outcome
      : { type: "failed", code: "build-failed", detail: result.reason };
  };

  return {
    run(job, options) {
      const outcome = queue.then(() => runOne(job, options));
      // The next export waits for this one to settle, however it ends: a failure here never
      // fails the exports after it.
      queue = outcome.catch(() => undefined);
      return outcome;
    },
    close() {
      channel.close();
    },
  };
}
