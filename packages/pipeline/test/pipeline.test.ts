import type { SitePage, SiteSnapshot } from "@webforge/model";
import * as components from "@webforge/site-components";
import { sampleSite } from "@webforge/test-utils";
import { scaledTestTimeout } from "@webforge/test-utils/vitest";
import * as tailwind from "tailwindcss";
import { beforeAll, describe, expect, it, onTestFinished, vi } from "vitest";
import { type BuiltSite, buildSite, PREVIEW_STYLESHEET } from "../src/build.js";
import { createMemoryImageCache } from "../src/memory-image-cache.js";
import { loadNodeResources } from "../src/node-resources.js";
import { createPipeline, type Pipeline, type PipelineEvent } from "../src/pipeline.js";
import type { PipelineResources } from "../src/resources.js";

// Counts the pages rendered, to tell a cached page from a rendered one.
vi.mock("@webforge/site-components", async (original) => {
  const actual = await original<typeof components>();
  return { ...actual, renderPage: vi.fn(actual.renderPage) };
});
const renderPage = vi.mocked(components.renderPage);

// Counts Tailwind's compiles, to tell a kept stylesheet compiler from a new one (3.2).
vi.mock("tailwindcss", async (original) => {
  const actual = await original<typeof import("tailwindcss")>();
  return { ...actual, compile: vi.fn(actual.compile) };
});
const compile = vi.mocked(tailwind.compile);

let resources: PipelineResources;

beforeAll(async () => {
  resources = await loadNodeResources();
}, scaledTestTimeout(60_000));

/**
 * A signal aborted when the running test ends, however it ends (#531): a build it started, still
 * running after a timeout or a failure, stops rather than rendering into the next test, whose
 * `renderPage` counts it would change.
 */
function testSignal(): AbortSignal {
  const controller = new AbortController();
  onTestFinished(() => controller.abort());
  return controller.signal;
}

/** Runs one build of `pipeline`, returning its events and the site; it stops when the test ends. */
async function build(
  pipeline: Pipeline,
  snapshot: SiteSnapshot,
  mode: "preview" | "export" = "export",
  signal: AbortSignal = testSignal(),
  using: PipelineResources = resources,
) {
  const events: PipelineEvent[] = [];
  for await (const event of pipeline.build(snapshot, using, { mode, signal })) {
    events.push(event);
  }
  const last = events.at(-1);
  if (last?.stage !== "done") throw new Error("The build didn't finish");
  return { events, site: last.site };
}

const sameFiles = (actual: BuiltSite, expected: BuiltSite, edit: string) => {
  expect([...actual.files.keys()], edit).toEqual([...expected.files.keys()]);
  const text = new TextDecoder();
  for (const [path, data] of expected.files) {
    const built = actual.files.get(path) ?? new Uint8Array();
    // The bytes at once: `toEqual` walks each image byte by byte, which was most of this file's
    // run (5–7 s an edit, #531).
    if (Buffer.compare(built, data) === 0) continue;
    // A text file shows where it differs; an image only that it does.
    if (/\.(?:html|css|js|txt|xml|json)$/.test(path)) {
      expect(text.decode(built), `${edit}: ${path}`).toBe(text.decode(data));
    } else {
      expect.fail(`${edit}: ${path} differs`);
    }
  }
  expect(actual.report, edit).toEqual(expected.report);
};

/** `site` with `page`'s content text changed: `from` replaced by `to`. */
const withText = (site: SiteSnapshot, index: number, from: string, to: string): SiteSnapshot => ({
  ...site,
  pages: site.pages.map((page, at) =>
    at === index ? { ...page, doc: JSON.parse(JSON.stringify(page.doc).replace(from, to)) } : page,
  ),
});

const withPage = (site: SiteSnapshot, index: number, change: Partial<SitePage>): SiteSnapshot => ({
  ...site,
  pages: site.pages.map((page, at) => (at === index ? { ...page, ...change } : page)),
});

describe("createPipeline (3.1)", () => {
  it(
    "builds exactly what buildSite builds, through a series of edits",
    async () => {
      const pipeline = createPipeline(components.siteLibrary);
      // One image cache for both, so each image is encoded once: the pages and stylesheets are
      // what's compared.
      const fresh = { ...resources, imageCache: createMemoryImageCache(64 * 1024 * 1024) };
      const base = sampleSite();
      const about = base.pages[1];
      const edits: [string, SiteSnapshot][] = [
        ["first build", base],
        ["unchanged", base],
        ["text on one page", withText(base, 0, "Baked fresh every morning", "Fresh at seven")],
        ["a page renamed in the menu", withPage(base, 1, { title: "Who we are" })],
        ["a page moved", withPage(base, 1, { path: `company/${about?.path ?? "about"}` })],
        ["the site's name", { ...base, name: "Rosa's" }],
        [
          "a Site Settings value",
          { ...base, settings: { ...base.settings, "contact.phone": "0" } },
        ],
        ["the image deleted from Media", { ...base, media: [] }],
        [
          "the image's alt text",
          { ...base, media: base.media.map((item) => ({ ...item, alt: "Hills" })) },
        ],
        ["the theme", { ...base, theme: { ...base.theme, preset: "dark" } }],
        ["no back-to-top button", { ...base, backToTop: false }],
        ["back to the start", base],
      ];

      for (const [edit, snapshot] of edits) {
        const { site } = await build(pipeline, snapshot, "export", undefined, fresh);
        const direct = await buildSite(snapshot, components.siteLibrary, fresh, {
          signal: testSignal(),
        });
        sameFiles(site, direct, edit);
      }
    },
    scaledTestTimeout(180_000),
  );

  it(
    "renders again only the pages a change reaches",
    async () => {
      const pipeline = createPipeline(components.siteLibrary);
      const base = sampleSite();
      await build(pipeline, base);

      renderPage.mockClear();
      await build(pipeline, base);
      expect(renderPage).not.toHaveBeenCalled();

      await build(pipeline, withText(base, 0, "Baked fresh every morning", "Fresh at seven"));
      expect(renderPage).toHaveBeenCalledTimes(1);

      // The Header and Footer are on every page, and so is the menu with the page's title.
      renderPage.mockClear();
      await build(pipeline, withPage(base, 1, { title: "Who we are" }));
      expect(renderPage).toHaveBeenCalledTimes(base.pages.length);
    },
    scaledTestTimeout(120_000),
  );

  it(
    "takes the site's own CSS into a preview with no page rendered and no new compile (3.9)",
    async () => {
      const pipeline = createPipeline(components.siteLibrary);
      const code = { css: ".sale { color: red; }", js: "", head: "", bodyEnd: "" };
      const base = { ...sampleSite(), code };
      await build(pipeline, base, "preview");

      renderPage.mockClear();
      compile.mockClear();
      const { site } = await build(
        pipeline,
        { ...base, code: { ...code, css: ".sale { color: blue; }" } },
        "preview",
      );

      expect(renderPage).not.toHaveBeenCalled();
      expect(compile).not.toHaveBeenCalled();
      const path = [...site.files.keys()].find((file) => /custom\.[0-9a-f]+\.css$/.test(file));
      expect(new TextDecoder().decode(site.files.get(path ?? ""))).toContain("blue");
      expect(new TextDecoder().decode(site.files.get("index.html"))).toContain(path);
    },
    scaledTestTimeout(120_000),
  );

  it(
    "takes a colour or a size of the theme into a preview with no new compile and no page rendered (3.2)",
    async () => {
      const pipeline = createPipeline(components.siteLibrary);
      const base = sampleSite();
      const css = (site: BuiltSite) => new TextDecoder().decode(site.files.get(PREVIEW_STYLESHEET));
      await build(pipeline, base, "preview");

      renderPage.mockClear();
      compile.mockClear();
      const recoloured = {
        ...base,
        theme: {
          ...base.theme,
          colors: { ...base.theme.colors, primary: { l: 0.4, c: 0.2, h: 20 } },
          spacing: "roomy" as const,
        },
      };
      const { site } = await build(pipeline, recoloured, "preview");

      expect(compile).not.toHaveBeenCalled();
      expect(renderPage).not.toHaveBeenCalled();
      // The new values follow the compiled stylesheet, as custom properties that win over it.
      expect(css(site)).toMatch(
        /--color-primary: oklch\(40% 0\.2 20\);[^}]*--spacing: 0\.275rem;/s,
      );
      // A change of shape (here, the shadows) compiles again.
      await build(
        pipeline,
        { ...recoloured, theme: { ...recoloured.theme, shadow: "strong" } },
        "preview",
      );
      expect(compile).toHaveBeenCalledOnce();
      // An export is compiled with the theme itself, as ever.
      compile.mockClear();
      const exported = (await build(pipeline, recoloured, "export")).site;
      expect(
        [...exported.files.values()].some((data) =>
          new TextDecoder().decode(data).includes("The theme's values"),
        ),
      ).toBe(false);
    },
    scaledTestTimeout(120_000),
  );

  it(
    "tells each stage as it starts, and gives the site last",
    async () => {
      const pipeline = createPipeline(components.siteLibrary);

      const { events } = await build(pipeline, sampleSite());

      expect(events.map((event) => event.stage)).toEqual([
        ...sampleSite().media.map(() => "images"),
        ...sampleSite().pages.map(() => "pages"),
        "styles",
        "fonts",
        "done",
      ]);
    },
    scaledTestTimeout(60_000),
  );

  it(
    "keeps what an earlier build left when one is cancelled",
    async () => {
      const pipeline = createPipeline(components.siteLibrary);
      await build(pipeline, sampleSite());
      const controller = new AbortController();
      controller.abort();

      await expect(
        build(pipeline, sampleSite(), "export", controller.signal),
      ).rejects.toMatchObject({
        name: "BuildError",
        code: "cancelled",
      });

      renderPage.mockClear();
      await build(pipeline, sampleSite());
      expect(renderPage).not.toHaveBeenCalled();
    },
    scaledTestTimeout(60_000),
  );

  describe("a build a test leaves running (#531)", () => {
    let leftover: Promise<unknown> | undefined;

    it("is left behind when its test ends, as a test that times out leaves one", () => {
      leftover = build(createPipeline(components.siteLibrary), sampleSite());
      // Handled here: its rejection, once cancelled, is the next test's to check.
      leftover.catch(() => undefined);
    });

    it("is cancelled as its test ends, so it renders nothing into the next", async () => {
      renderPage.mockClear();

      await expect(leftover).rejects.toMatchObject({ name: "BuildError", code: "cancelled" });
      expect(renderPage).not.toHaveBeenCalled();
    });
  });

  it(
    "keeps the stylesheet's classes between previews, never between exports",
    async () => {
      const pipeline = createPipeline(components.siteLibrary);
      const base = sampleSite();
      // A class of its own on the home page's heading (F-ED-11).
      const styled = withText(
        base,
        0,
        '"id":"intro-heading"',
        '"id":"intro-heading","advanced":{"className":"skew-x-12"}',
      );
      const css = (site: BuiltSite) =>
        new TextDecoder().decode(
          site.files.get([...site.files.keys()].find((path) => path.endsWith(".css")) ?? ""),
        );
      expect(css((await build(pipeline, styled, "preview")).site)).toContain(".skew-x-12");

      expect(css((await build(pipeline, base, "preview")).site)).toContain(".skew-x-12");
      expect(css((await build(pipeline, base, "export")).site)).not.toContain(".skew-x-12");
    },
    scaledTestTimeout(60_000),
  );

  it(
    "names a preview's stylesheet the same whatever it holds, so its pages don't change (3.2)",
    async () => {
      const pipeline = createPipeline(components.siteLibrary);
      const base = sampleSite();
      const first = (await build(pipeline, base, "preview")).site;
      const dark = (
        await build(pipeline, { ...base, theme: { ...base.theme, preset: "dark" } }, "preview")
      ).site;

      expect(first.files.has(PREVIEW_STYLESHEET)).toBe(true);
      expect(dark.files.get(PREVIEW_STYLESHEET)).not.toEqual(first.files.get(PREVIEW_STYLESHEET));
      expect(new TextDecoder().decode(first.files.get("index.html"))).toContain(
        `href="${PREVIEW_STYLESHEET}"`,
      );
      // An export's is named by what it holds.
      const exported = (await build(pipeline, base, "export")).site;
      expect(
        [...exported.files.keys()].some((path) =>
          /^assets\/css\/site\.[0-9a-f]{10}\.css$/.test(path),
        ),
      ).toBe(true);
    },
    scaledTestTimeout(60_000),
  );
});
