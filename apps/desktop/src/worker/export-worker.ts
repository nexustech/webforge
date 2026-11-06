import { createPipeline } from "@webforge/pipeline";
import { siteLibrary } from "@webforge/site-components";
import { loadBundledResources, loadStyleResources } from "./bundled-resources.js";
import { createClassCatalogues } from "./class-catalogue.js";
import { compileCss } from "./compile-css.js";
import { installWorkerCrashHandlers } from "./crash-handlers.js";
import { itemHtmlFor } from "./item-html.js";
import { createJobDispatch } from "./job-dispatch.js";
import { thumbnailFor } from "./make-thumbnail.js";
import { runExport } from "./run-export.js";
import { createPreviewBuilds } from "./run-preview.js";
import { runPublish } from "./run-publish.js";

// Entry of the export utility process (pipeline "where the work runs", 07). An export runs in a
// process of its own; the canvas keeps one process for compiling its CSS (1.12), Media one for its
// thumbnails (1.16), and the preview server one for its builds (3.2). Wiring only: job-dispatch.ts
// routes each job, run-export.ts, compile-css.ts and make-thumbnail.ts hold the logic, and E2E
// tests cover this file.

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
const pipeline = createPipeline(siteLibrary);
// The preview server's builds (3.2), each answering with what changed since the last.
const preview = createPreviewBuilds(loadBundledResources, { pipeline });

// Each job by its kind, with what it reads, its cancel and its progress its own (A14).
const dispatch = createJobDispatch(
  {
    export: (job, { readMedia, signal, onProgress }) =>
      runExport(job, loadBundledResources, { readMedia, signal, pipeline, onProgress }),
    preview: (job, { readMedia }) => preview(job, { readMedia }),
    // A publish (4.5, ADR 0018 §1): built here, where an export is, and sent from here.
    publish: (job, { readMedia, signal, onProgress }) =>
      runPublish(job, loadBundledResources, {
        readMedia,
        signal,
        pipeline,
        library: siteLibrary,
        onProgress,
      }),
    thumbnail: (job) => thumbnailFor(job, loadBundledResources),
    "class-catalogue": (job) => classes(job),
    "class-css": (job) => classes(job),
    "item-html": (job) => itemHtmlFor(job),
    "compile-css": (job) => compileCss(job, loadStyleResources),
  },
  (message) => process.parentPort.postMessage(message),
);

process.parentPort.on("message", (event) => {
  dispatch(event.data);
});
