import type { SiteSnapshot } from "@webforge/model";
import { createMemoryImageCache, createPipeline, type PipelineResources } from "@webforge/pipeline";
import { loadNodeResources } from "@webforge/pipeline/node";
import { siteLibrary } from "@webforge/site-components";
import { beforeAll, describe, test } from "vitest";
import { measure } from "./measure.js";
import { exportSite, PAGES, withFirstText } from "./sites.js";

// The pipeline (architecture §10): a full export of 20 pages with its images cached (< 5 s), a
// page re-rendered for the preview (< 200 ms) and a theme colour reaching the preview's CSS
// (< 100 ms). The app runs these in the export worker and the preview's builder; here they run
// as the pipeline's own calls, without the worker's messages or the browser's reload.

type Pipeline = ReturnType<typeof createPipeline>;

let resources: PipelineResources;
const site = exportSite();

/** Runs one build of `snapshot` with `pipeline` to the end. */
async function build(
  pipeline: Pipeline,
  snapshot: SiteSnapshot,
  mode: "export" | "preview",
  using: PipelineResources = resources,
): Promise<void> {
  for await (const event of pipeline.build(snapshot, using, {
    mode,
    signal: new AbortController().signal,
  })) {
    if (event.stage === "done") return;
  }
  throw new Error("The build didn't finish");
}

beforeAll(async () => {
  resources = await loadNodeResources();
});

describe(`export, ${PAGES} pages (§10)`, () => {
  test("a full export, its images cached", async ({ bench }) => {
    // The images are encoded once, as the export worker's cache keeps them between exports.
    const imageCache = createMemoryImageCache(512 * 1024 * 1024);
    const cached = { ...resources, imageCache };
    await build(createPipeline(siteLibrary), site, "export", cached);
    await measure(
      bench,
      "export-full",
      // A new pipeline each time: no page or stylesheet kept from the export before.
      () => build(createPipeline(siteLibrary), site, "export", cached),
      { budgetMs: 5000, iterations: 5, time: 0, warmupIterations: 1 },
    );
  });
});

describe(`preview, ${PAGES} pages (§10)`, () => {
  // The preview's builder keeps its pages and stylesheet between builds, as the app's does.
  test("a page edited: its build for the preview", async ({ bench }) => {
    const pipeline = createPipeline(siteLibrary);
    await build(pipeline, site, "preview");
    let edit = 0;
    await measure(
      bench,
      "preview-page",
      () => {
        edit += 1;
        return build(pipeline, withFirstText(site, `Edited ${edit}`), "preview");
      },
      { budgetMs: 200, iterations: 20, time: 0, warmupIterations: 2 },
    );
  });

  test("a theme colour changed: its build for the preview", async ({ bench }) => {
    const pipeline = createPipeline(siteLibrary);
    await build(pipeline, site, "preview");
    let edit = 0;
    await measure(
      bench,
      "preview-theme-colour",
      () => {
        edit += 1;
        const primary = { l: 0.45, c: 0.24, h: edit % 360 };
        return build(
          pipeline,
          { ...site, theme: { ...site.theme, colors: { ...site.theme.colors, primary } } },
          "preview",
        );
      },
      { budgetMs: 100, iterations: 20, time: 0, warmupIterations: 2 },
    );
  });
});
