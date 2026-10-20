import {
  type ExportJob,
  type ExportOutcome,
  exportOutcomeSchema,
} from "../shared/export-worker-protocol.js";

/** The parts of an Electron `UtilityProcess` the client uses; injectable for tests. */
export type WorkerProcess = {
  postMessage(message: unknown): void;
  once(event: "message", listener: (message: unknown) => void): unknown;
  once(event: "exit", listener: (code: number) => void): unknown;
  kill(): boolean;
};

/** How long an export may take before the worker is stopped (large sites encode many images). */
const EXPORT_TIMEOUT_MS = 10 * 60_000;

/**
 * Runs one export job in a fresh utility process and resolves with its validated outcome. A worker
 * that exits early or answers with anything unexpected counts as a failed build, so the main
 * process never trusts its messages blindly. A worker that takes longer than `timeoutMs` (e.g. a
 * codec stuck on a corrupt image) is stopped, so the export can never hang forever.
 */
export function runExportInWorker(
  startWorker: () => WorkerProcess,
  job: ExportJob,
  timeoutMs = EXPORT_TIMEOUT_MS,
): Promise<ExportOutcome> {
  return new Promise((resolve) => {
    const worker = startWorker();
    let settled = false;
    const finish = (outcome: ExportOutcome) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(outcome);
      }
    };
    const timer = setTimeout(() => {
      finish({ type: "failed", code: "build-failed", detail: "timeout" });
      worker.kill();
    }, timeoutMs);
    worker.once("message", (message) => {
      const outcome = exportOutcomeSchema.safeParse(message);
      finish(
        outcome.success
          ? outcome.data
          : { type: "failed", code: "build-failed", detail: "invalid-worker-message" },
      );
      worker.kill();
    });
    worker.once("exit", (code) => {
      finish({ type: "failed", code: "build-failed", detail: `worker-exit-${code}` });
    });
    worker.postMessage(job);
  });
}
