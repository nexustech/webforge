import { createPipeline, type StoredMedia } from "@webforge/pipeline";
import { siteLibrary } from "@webforge/site-components";
import {
  type ExportJob,
  exportMessageSchema,
  workerJobSchema,
} from "../shared/export-worker-protocol.js";
import { loadBundledResources, loadStyleResources } from "./bundled-resources.js";
import { createClassCatalogues } from "./class-catalogue.js";
import { compileCss } from "./compile-css.js";
import { installWorkerCrashHandlers } from "./crash-handlers.js";
import { thumbnailFor } from "./make-thumbnail.js";
import { runExport } from "./run-export.js";
import { createPreviewBuilds } from "./run-preview.js";

// Entry of the export utility process (pipeline "where the work runs", 07). An export runs in a
// process of its own; the canvas keeps one process for compiling its CSS (1.12), Media one for its
// thumbnails (1.16), and the preview server one for its builds (3.2). Wiring only; run-export.ts, compile-css.ts and make-thumbnail.ts hold
// the logic and E2E tests cover this file.

// An error nothing caught ends the worker, with a crash report of its frames (R3).
installWorkerCrashHandlers(
  process,
  (crash) => process.parentPort.postMessage(crash),
  () => process.exit(1),
);

// The canvas styles worker's class catalogue (#276), kept per theme for the next jobs.
const classes = createClassCatalogues(loadStyleResources);

// An export asks the main process for each stored image and document as the build reaches it
// (R15), tells it how far it has come, and stops when the main process cancels it. The worker
// lives while the site is open, its pipeline keeping the images it encoded, the pages it rendered
// and its Tailwind compiler in memory for the next export, and never on disk (R13d, 3.1).
const reads = new Map<number, (blob: StoredMedia | undefined) => void>();
let nextRead = 0;
const readMedia = (hash: string) =>
  new Promise<StoredMedia | undefined>((resolve) => {
    const id = nextRead++;
    reads.set(id, resolve);
    process.parentPort.postMessage({ type: "read-blob", id, hash });
  });
let cancelled = new AbortController();
const pipeline = createPipeline(siteLibrary);
// The preview server's builds (3.2), each answering with what changed since the last.
const preview = createPreviewBuilds(loadBundledResources, { readMedia, pipeline });

/** Runs one export, with a signal of its own: a late cancel of the one before can't stop it. */
function startExport(job: ExportJob) {
  cancelled = new AbortController();
  return runExport(job, loadBundledResources, {
    readMedia,
    signal: cancelled.signal,
    pipeline,
    onProgress: (progress) => process.parentPort.postMessage({ type: "progress", progress }),
  });
}

process.parentPort.on("message", (event) => {
  const message = exportMessageSchema.safeParse(event.data);
  if (message.success) {
    if (message.data.type === "cancel") {
      cancelled.abort();
    } else {
      reads.get(message.data.id)?.(message.data.blob);
      reads.delete(message.data.id);
    }
    return;
  }
  const job = workerJobSchema.safeParse(event.data);
  const outcome = !job.success
    ? Promise.resolve({ type: "failed", code: "build-failed", detail: "invalid-job" } as const)
    : job.data.type === "export"
      ? startExport(job.data)
      : job.data.type === "preview"
        ? preview(job.data)
        : job.data.type === "thumbnail"
          ? thumbnailFor(job.data, loadBundledResources)
          : job.data.type === "class-catalogue" || job.data.type === "class-css"
            ? classes(job.data)
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
