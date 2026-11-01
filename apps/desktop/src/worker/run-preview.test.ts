import type { SiteSnapshot } from "@webforge/model";
import { createPipeline, PREVIEW_STYLESHEET } from "@webforge/pipeline";
import { loadNodeResources } from "@webforge/pipeline/node";
import { siteLibrary } from "@webforge/site-components";
import { sampleSite } from "@webforge/test-utils";
import { fontFacesFor } from "@webforge/themes";
import { describe, expect, it } from "vitest";
import type { PreviewJob, PreviewOutcome } from "../shared/export-worker-protocol.js";
import { createPreviewBuilds } from "./run-preview.js";

/** A preview of `snapshot`, with the site's font files as the main process sends them (2.2). */
async function job(snapshot: SiteSnapshot): Promise<PreviewJob> {
  const { readFont } = await loadNodeResources();
  const fonts = await Promise.all(
    fontFacesFor(snapshot.theme).map(async (face) => ({
      file: face.file,
      data: (await readFont(face)) ?? new Uint8Array(),
    })),
  );
  return { type: "preview", snapshot, fonts, families: [] };
}

/** The paths a build says changed, and those gone; a failed one fails the test. */
function paths(outcome: PreviewOutcome) {
  if (outcome.type !== "previewed") throw new Error(`The build failed: ${outcome.detail}`);
  return {
    full: outcome.full,
    changed: outcome.changed.map((file) => file.path),
    removed: outcome.removed,
  };
}

describe("createPreviewBuilds (3.2)", () => {
  it("answers with every file first, then only what each change changed", async () => {
    const build = createPreviewBuilds(loadNodeResources, { pipeline: createPipeline(siteLibrary) });
    const preview = (each: PreviewJob) => build(each, { readMedia: async () => undefined });
    const site = sampleSite();

    const first = paths(await preview(await job(site)));
    expect(first).toMatchObject({ full: true, removed: [] });
    expect(first.changed).toEqual(expect.arrayContaining(["index.html", PREVIEW_STYLESHEET]));

    // The same site again: nothing to send.
    expect(paths(await preview(await job(site)))).toEqual({
      full: false,
      changed: [],
      removed: [],
    });

    // A colour of the theme: the stylesheet alone, swapped in place in the browser.
    const recoloured: SiteSnapshot = {
      ...site,
      theme: {
        ...site.theme,
        colors: { ...site.theme.colors, primary: { l: 0.4, c: 0.2, h: 20 } },
      },
    };
    expect(paths(await preview(await job(recoloured)))).toEqual({
      full: false,
      changed: [PREVIEW_STYLESHEET],
      removed: [],
    });

    // A word on the home page: that page alone.
    const edited: SiteSnapshot = {
      ...recoloured,
      pages: recoloured.pages.map((page, at) =>
        at === 0
          ? { ...page, doc: JSON.parse(JSON.stringify(page.doc).replace("Our bakery", "Our shop")) }
          : page,
      ),
    };
    expect(paths(await preview(await job(edited)))).toEqual({
      full: false,
      changed: ["index.html"],
      removed: [],
    });

    // A page gone: its file is gone too.
    const fewer: SiteSnapshot = { ...edited, pages: edited.pages.slice(0, 1) };
    expect(paths(await preview(await job(fewer))).removed.length).toBeGreaterThan(0);
  }, 120_000);

  it("fails with a code, never the site's content", async () => {
    const build = createPreviewBuilds(loadNodeResources, { pipeline: createPipeline(siteLibrary) });
    const preview = (each: PreviewJob) => build(each, { readMedia: async () => undefined });
    // No font files sent: the build can't write the site's fonts.
    const site = sampleSite();

    expect(await preview({ type: "preview", snapshot: site, fonts: [], families: [] })).toEqual({
      type: "preview-failed",
      detail: "missing-font",
    });
  }, 60_000);
});
