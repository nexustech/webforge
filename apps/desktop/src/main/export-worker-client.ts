import {
  blobRequestSchema,
  type ExportJob,
  type ExportMessage,
  type ExportOutcome,
  exportOutcomeSchema,
  exportProgressMessageSchema,
} from "../shared/export-worker-protocol.js";
import type { ExportProgress } from "../shared/ipc/site.js";
import type { WorkerProcess } from "./worker-process.js";

/** How long an export may take before the worker is stopped (large sites encode many images). */
const EXPORT_TIMEOUT_MS = 10 * 60_000;

/** What the export worker can ask of the main process during one export, and how it's cancelled. */
export type ExportOptions = {
  /**
   * The bytes and type the open site stores under a hash, for the image or document the build has
   * reached (R15): read one at a time, as the worker asks, so main never holds them all.
   */
  readonly readMedia: (
    hash: string,
  ) => Promise<{ readonly data: Uint8Array; readonly mime: string } | undefined>;
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

/** The export under way: how it ends, and how it reads the site's stored bytes. */
type Running = {
  readonly finish: (outcome: ExportOutcome) => void;
  readonly options: ExportOptions;
};

/**
 * Runs exports in a utility process kept while the site is open, so the images it encoded stay
 * cached in its memory for the next export (R15), and nothing about them is kept on disk. Exports
 * run one at a time. A worker that exits, answers with anything unexpected or takes longer than
 * `timeoutMs` (e.g. a codec stuck on a corrupt image) fails that export and is replaced for the
 * next, so the main process never trusts its messages blindly and an export never hangs forever.
 */
export function createExportRunner(
  startWorker: () => WorkerProcess,
  timeoutMs = EXPORT_TIMEOUT_MS,
): ExportRunner {
  let worker: WorkerProcess | undefined;
  let running: Running | undefined;
  let queue: Promise<unknown> = Promise.resolve();

  /** Stops `stopping` and forgets it, so the next export starts a fresh worker. */
  const discard = (stopping: WorkerProcess) => {
    if (worker === stopping) worker = undefined;
    stopping.kill();
  };

  /** The worker, started with its listeners on first use. */
  const ready = (): WorkerProcess => {
    if (worker !== undefined) return worker;
    const started = startWorker();
    worker = started;
    const send = (message: ExportMessage) => started.postMessage(message);
    started.on("message", (message) => {
      if (worker !== started) return;
      const request = blobRequestSchema.safeParse(message);
      if (request.success) {
        const current = running;
        const { id, hash } = request.data;
        // A failed read is a missing file: the build leaves it out, with a warning.
        void (current?.options.readMedia(hash) ?? Promise.resolve(undefined))
          .catch(() => undefined)
          .then((blob) => {
            if (running !== current || worker !== started) return;
            // Only the bytes and their type: the worker's schema takes nothing else.
            send(
              blob === undefined
                ? { type: "blob", id }
                : { type: "blob", id, blob: { data: blob.data, mime: blob.mime } },
            );
          });
        return;
      }
      const progress = exportProgressMessageSchema.safeParse(message);
      if (progress.success) {
        running?.options.onProgress?.(progress.data.progress);
        return;
      }
      const outcome = exportOutcomeSchema.safeParse(message);
      if (outcome.success) {
        running?.finish(outcome.data);
      } else {
        running?.finish({ type: "failed", code: "build-failed", detail: "invalid-worker-message" });
        discard(started);
      }
    });
    started.on("exit", (code) => {
      if (worker === started) worker = undefined;
      running?.finish({ type: "failed", code: "build-failed", detail: `worker-exit-${code}` });
    });
    return started;
  };

  const runOne = (job: ExportJob, options: ExportOptions) =>
    new Promise<ExportOutcome>((resolve) => {
      const current = ready();
      const cancel = () => current.postMessage({ type: "cancel" } satisfies ExportMessage);
      const timer = setTimeout(() => {
        finish({ type: "failed", code: "build-failed", detail: "timeout" });
        discard(current);
      }, timeoutMs);
      const finish = (outcome: ExportOutcome) => {
        if (running?.finish !== finish) return;
        running = undefined;
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", cancel);
        resolve(outcome);
      };
      running = { finish, options };
      current.postMessage(job);
      if (options.signal?.aborted === true) cancel();
      else options.signal?.addEventListener("abort", cancel, { once: true });
    });

  return {
    run(job, options) {
      const outcome = queue.then(() => runOne(job, options));
      queue = outcome;
      return outcome;
    },
    close() {
      if (worker !== undefined) discard(worker);
    },
  };
}
