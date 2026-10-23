import { workerJobSchema } from "../shared/export-worker-protocol.js";
import { loadBundledResources, loadStyleResources } from "./bundled-resources.js";
import { compileCss } from "./compile-css.js";
import { installWorkerCrashHandlers } from "./crash-handlers.js";
import { thumbnailFor } from "./make-thumbnail.js";
import { runExport } from "./run-export.js";

// Entry of the export utility process (pipeline "where the work runs", 07). An export runs in a
// process of its own; the canvas keeps one process for compiling its CSS (1.12), and Media one
// for its thumbnails (1.16). Wiring only; run-export.ts, compile-css.ts and make-thumbnail.ts hold
// the logic and E2E tests cover this file.

// An error nothing caught ends the worker, with a crash report of its frames (R3).
installWorkerCrashHandlers(
  process,
  (crash) => process.parentPort.postMessage(crash),
  () => process.exit(1),
);

process.parentPort.on("message", (event) => {
  const job = workerJobSchema.safeParse(event.data);
  const outcome = !job.success
    ? Promise.resolve({ type: "failed", code: "build-failed", detail: "invalid-job" } as const)
    : job.data.type === "export"
      ? runExport(job.data, loadBundledResources)
      : job.data.type === "thumbnail"
        ? thumbnailFor(job.data, loadBundledResources)
        : compileCss(job.data, loadStyleResources);
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
