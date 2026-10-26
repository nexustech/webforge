import { createMemoryImageCache, type StoredMedia } from "@webforge/pipeline";
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

// The canvas styles worker's class catalogue (#276), kept per theme for the next jobs.
const classes = createClassCatalogues(loadStyleResources);

// An export asks the main process for each stored image and document as the build reaches it
// (R15), and stops when the main process cancels it. The worker lives while the site is open,
// keeping the images it encoded in memory for the next export, and never on disk (R13d).
const reads = new Map<number, (blob: StoredMedia | undefined) => void>();
let nextRead = 0;
const readMedia = (hash: string) =>
  new Promise<StoredMedia | undefined>((resolve) => {
    const id = nextRead++;
    reads.set(id, resolve);
    process.parentPort.postMessage({ type: "read-blob", id, hash });
  });
let cancelled = new AbortController();
const IMAGE_CACHE_BYTES = 256 * 1024 * 1024;
const imageCache = createMemoryImageCache(IMAGE_CACHE_BYTES);

/** Runs one export, with a signal of its own: a late cancel of the one before can't stop it. */
function startExport(job: ExportJob) {
  cancelled = new AbortController();
  return runExport(job, loadBundledResources, { readMedia, signal: cancelled.signal, imageCache });
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
