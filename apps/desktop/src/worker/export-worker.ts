import { workerJobSchema } from "../shared/export-worker-protocol.js";
import { loadBundledResources, loadStyleResources } from "./bundled-resources.js";
import { compileCss } from "./compile-css.js";
import { runExport } from "./run-export.js";

// Entry of the export utility process (pipeline "where the work runs", 07). An export runs in a
// process of its own; the canvas keeps one process for compiling its CSS (1.12). Wiring only;
// run-export.ts and compile-css.ts hold the logic and E2E tests cover this file.

process.parentPort.on("message", (event) => {
  const job = workerJobSchema.safeParse(event.data);
  const outcome = !job.success
    ? Promise.resolve({ type: "failed", code: "build-failed", detail: "invalid-job" } as const)
    : job.data.type === "export"
      ? runExport(job.data, loadBundledResources)
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
