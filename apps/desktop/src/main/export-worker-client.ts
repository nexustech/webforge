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

/**
 * Runs one export job in a fresh utility process and resolves with its validated outcome. A worker
 * that exits early or answers with anything unexpected counts as a failed build, so the main
 * process never trusts its messages blindly.
 */
export function runExportInWorker(
  startWorker: () => WorkerProcess,
  job: ExportJob,
): Promise<ExportOutcome> {
  return new Promise((resolve) => {
    const worker = startWorker();
    let settled = false;
    const finish = (outcome: ExportOutcome) => {
      if (!settled) {
        settled = true;
        resolve(outcome);
      }
    };
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
