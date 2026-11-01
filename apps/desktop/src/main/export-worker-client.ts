import {
  type ExportJob,
  type ExportOutcome,
  exportOutcomeSchema,
  type PublishJob,
  type PublishOutcome,
  publishOutcomeSchema,
} from "../shared/export-worker-protocol.js";
import { type PublishProgress, publishProgressSchema } from "../shared/ipc/publish.js";
import { type ExportProgress, exportProgressSchema } from "../shared/ipc/site.js";
import { createWorkerChannel, type ReadMedia } from "./worker-channel.js";
import type { WorkerProcess } from "./worker-process.js";

/** How long an export may take before the worker is stopped (large sites encode many images). */
const EXPORT_TIMEOUT_MS = 10 * 60_000;

/** How long a publish may take: the build, then every file sent over a slow connection (4.5). */
const PUBLISH_TIMEOUT_MS = 60 * 60_000;

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
  /**
   * Publishes `job` in the same worker, once the jobs before it are done (ADR 0018 §1): the build
   * it has cached serves a publish too.
   */
  publish(
    job: PublishJob,
    options: Omit<ExportOptions, "onProgress"> & {
      readonly onProgress?: ((progress: PublishProgress) => void) | undefined;
    },
  ): Promise<PublishOutcome>;
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
  publishTimeoutMs = PUBLISH_TIMEOUT_MS,
): ExportRunner {
  const channel = createWorkerChannel(startWorker);
  let queue: Promise<unknown> = Promise.resolve();

  const runOne = async (job: ExportJob, options: ExportOptions): Promise<ExportOutcome> => {
    const result = await channel.run(job, {
      outcome: exportOutcomeSchema,
      timeoutMs,
      signal: options.signal,
      // An export's own stages: the worker sends nothing else for an export.
      onProgress: (progress) => {
        const own = exportProgressSchema.safeParse(progress);
        if (own.success) options.onProgress?.(own.data);
      },
      readMedia: options.readMedia,
    });
    return result.ok
      ? result.outcome
      : { type: "failed", code: "build-failed", detail: result.reason };
  };

  /** Runs `start` once the jobs before it are done; the next waits for it, however it ends. */
  const queued = <T>(start: () => Promise<T>): Promise<T> => {
    const outcome = queue.then(start);
    queue = outcome.catch(() => undefined);
    return outcome;
  };

  return {
    run: (job, options) => queued(() => runOne(job, options)),
    publish: (job, options) =>
      queued(async (): Promise<PublishOutcome> => {
        const result = await channel.run(job, {
          outcome: publishOutcomeSchema,
          timeoutMs: publishTimeoutMs,
          signal: options.signal,
          // A publish's own stages: the worker sends nothing else for a publish.
          onProgress: (progress) => {
            const own = publishProgressSchema.safeParse(progress);
            if (own.success) options.onProgress?.(own.data);
          },
          readMedia: options.readMedia,
        });
        return result.ok
          ? result.outcome
          : { type: "failed", code: "failed", detail: result.reason.slice(0, 200) };
      }),
    close() {
      channel.close();
    },
  };
}
