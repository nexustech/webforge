import {
  blobRequestSchema,
  type ExportJob,
  type ExportMessage,
  type ExportOutcome,
  exportOutcomeSchema,
} from "../shared/export-worker-protocol.js";
import type { WorkerProcess } from "./worker-process.js";

/** How long an export may take before the worker is stopped (large sites encode many images). */
const EXPORT_TIMEOUT_MS = 10 * 60_000;

/** What the export worker can ask of the main process while it runs, and how it's cancelled. */
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
  readonly timeoutMs?: number | undefined;
};

/**
 * Runs one export job in a fresh utility process and resolves with its validated outcome. A worker
 * that exits early or answers with anything unexpected counts as a failed build, so the main
 * process never trusts its messages blindly. A worker that takes longer than `timeoutMs` (e.g. a
 * codec stuck on a corrupt image) is stopped, so the export can never hang forever. While it runs,
 * the worker asks for the site's stored images and documents (`readMedia`) one by one.
 */
export function runExportInWorker(
  startWorker: () => WorkerProcess,
  job: ExportJob,
  options: ExportOptions,
): Promise<ExportOutcome> {
  return new Promise((resolve) => {
    const worker = startWorker();
    const send = (message: ExportMessage) => worker.postMessage(message);
    let settled = false;
    const cancel = () => send({ type: "cancel" });
    const finish = (outcome: ExportOutcome) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", cancel);
        resolve(outcome);
      }
    };
    const timer = setTimeout(() => {
      finish({ type: "failed", code: "build-failed", detail: "timeout" });
      worker.kill();
    }, options.timeoutMs ?? EXPORT_TIMEOUT_MS);
    worker.on("message", (message) => {
      const request = blobRequestSchema.safeParse(message);
      if (request.success) {
        const { id, hash } = request.data;
        // A failed read is a missing file: the build leaves it out, with a warning.
        void options
          .readMedia(hash)
          .catch(() => undefined)
          .then((blob) => {
            if (settled) return;
            // Only the bytes and their type: the worker's schema takes nothing else.
            send(
              blob === undefined
                ? { type: "blob", id }
                : { type: "blob", id, blob: { data: blob.data, mime: blob.mime } },
            );
          });
        return;
      }
      const outcome = exportOutcomeSchema.safeParse(message);
      finish(
        outcome.success
          ? outcome.data
          : { type: "failed", code: "build-failed", detail: "invalid-worker-message" },
      );
      worker.kill();
    });
    worker.on("exit", (code) => {
      finish({ type: "failed", code: "build-failed", detail: `worker-exit-${code}` });
    });
    worker.postMessage(job);
    if (options.signal?.aborted === true) cancel();
    else options.signal?.addEventListener("abort", cancel, { once: true });
  });
}
