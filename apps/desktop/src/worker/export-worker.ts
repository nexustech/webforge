import { exportJobSchema } from "../shared/export-worker-protocol.js";
import { loadBundledResources } from "./bundled-resources.js";
import { runExport } from "./run-export.js";

// Entry of the export utility process (pipeline "where the work runs", 07): one job per process.
// Wiring only; run-export.ts holds the logic and E2E tests cover this file.

process.parentPort.once("message", (event) => {
  const job = exportJobSchema.safeParse(event.data);
  const outcome = job.success
    ? runExport(job.data, loadBundledResources)
    : Promise.resolve({ type: "failed", code: "build-failed", detail: "invalid-job" } as const);
  outcome
    .then((result) => {
      process.parentPort.postMessage(result);
    })
    .catch(() => {
      process.parentPort.postMessage({
        type: "failed",
        code: "build-failed",
        detail: "unexpected",
      });
    });
});
