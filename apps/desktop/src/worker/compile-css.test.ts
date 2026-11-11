import { CANVAS_EVEN_SECTIONS } from "@webforge/engine/puck-dom";
import { DEFAULT_THEME } from "@webforge/model";
import type { StyleResources } from "@webforge/pipeline";
import * as pipeline from "@webforge/pipeline";
import { loadNodeResources } from "@webforge/pipeline/node";
import type { CatalogueFont } from "@webforge/themes";
import { describe, expect, it, vi } from "vitest";
import type { CompileCssJob } from "../shared/export-worker-protocol.js";
import { createCompileCss } from "./compile-css.js";

// Counts the style compilers a worker makes, to tell a kept one from a new one (#945).
vi.mock("@webforge/pipeline", async (original) => {
  const actual = await original<typeof import("@webforge/pipeline")>();
  return { ...actual, createStyleCompiler: vi.fn(actual.createStyleCompiler) };
});
const createStyleCompiler = vi.mocked(pipeline.createStyleCompiler);

/** One job, in a worker of its own. */
function compileCss(job: CompileCssJob, load: () => StyleResources | Promise<StyleResources>) {
  return createCompileCss(load)(job);
}

describe("compileCss", () => {
  it("compiles the classes the site uses, the body's classes and the theme", async () => {
    const outcome = await compileCss(
      {
        type: "compile-css",
        theme: { ...DEFAULT_THEME, preset: "light" },
        candidates: ["btn", "text-4xl"],
        families: [],
      },
      loadNodeResources,
    );

    expect(outcome).toMatchObject({ type: "css" });
    if (outcome.type !== "css") return;
    expect(outcome.css).toContain(".btn");
    expect(outcome.css).toContain(".text-4xl");
    // The body classes of exported pages, so the canvas looks like the export.
    expect(outcome.bodyClass).toContain("bg-base-100");
    expect(outcome.css).toContain(".bg-base-100");
    // Fonts load through the main process's font scheme (2.2).
    expect(outcome.css).toContain('url("webforge-font://fonts/inter-latin-wght-normal.woff2")');
    // Classes the site doesn't use aren't compiled.
    expect(outcome.css).not.toContain(".text-9xl");
  }, 60_000);

  it("stripes the canvas's sections, in Puck's wrappers, as the theme stripes the page's (A19)", async () => {
    const outcome = await compileCss(
      {
        type: "compile-css",
        theme: { ...DEFAULT_THEME, preset: "light", sections: { rhythm: "alternating" } },
        candidates: [],
        families: [],
      },
      loadNodeResources,
    );

    expect(outcome).toMatchObject({ type: "css" });
    if (outcome.type !== "css") return;
    const css = outcome.css.replace(/\s+/g, " ");
    expect(css).toContain(
      `${CANVAS_EVEN_SECTIONS}:not([data-theme]) { background-color: var(--color-base-200); }`,
    );
    expect(css).toContain("#main > section:nth-child(even of section):not([data-theme])");
  }, 60_000);

  it("declares a downloaded family the job names, as the export would (2.2)", async () => {
    const comic: CatalogueFont = {
      id: "comic-neue",
      family: "Comic Neue",
      category: "handwriting",
      fallback: "serif",
      licence: "OFL-1.1",
      variable: false,
      weights: [400],
      styles: ["normal"],
      package: "@fontsource/comic-neue",
      version: "5.3.0",
      files: [
        {
          file: "comic-neue-latin-400-normal.woff2",
          subset: "latin",
          style: "normal",
          weight: 400,
          unicodeRange: "U+0000-00FF",
          bytes: 4,
          sha256: "0".repeat(64),
        },
      ],
    };
    const theme = {
      ...DEFAULT_THEME,
      preset: "light",
      fonts: { ...DEFAULT_THEME.fonts, heading: { family: "Comic Neue", fallback: "serif" } },
    } as const;

    const outcome = await compileCss(
      { type: "compile-css", theme, candidates: [], families: [comic] },
      loadNodeResources,
    );

    expect(outcome.type === "css" ? outcome.css : "").toContain(
      'url("webforge-font://fonts/comic-neue-latin-400-normal.woff2")',
    );
  }, 60_000);

  it("compiles the whole site's classes after the shown page's as a fresh worker would (#945)", async () => {
    const theme = { ...DEFAULT_THEME, preset: "light" } as const;
    const job = (candidates: string[]): CompileCssJob => ({
      type: "compile-css",
      theme,
      candidates,
      families: [],
    });
    const compile = createCompileCss(loadNodeResources);
    createStyleCompiler.mockClear();

    // The shown page's, then the whole site's while the first is compiled (#895).
    const [shown, site] = await Promise.all([
      compile(job(["btn"])),
      compile(job(["btn", "text-4xl"])),
    ]);
    // An edit that removes a class.
    const edited = await compile(job(["text-4xl"]));
    // One for the worker, however close together its first jobs came.
    expect(createStyleCompiler).toHaveBeenCalledOnce();

    expect(shown).toEqual(await compileCss(job(["btn"]), loadNodeResources));
    expect(site).toEqual(await compileCss(job(["btn", "text-4xl"]), loadNodeResources));
    expect(edited).toEqual(await compileCss(job(["text-4xl"]), loadNodeResources));
  }, 60_000);

  it("reports a failure without details, and loads its resources again for the next job", async () => {
    const load = vi
      .fn<() => Promise<StyleResources>>()
      .mockRejectedValueOnce(new Error("no resources"))
      .mockImplementation(loadNodeResources);
    const compile = createCompileCss(load);
    const job: CompileCssJob = {
      type: "compile-css",
      theme: { ...DEFAULT_THEME, preset: "light" },
      candidates: ["btn"],
      families: [],
    };

    expect(await compile(job)).toEqual({ type: "css-failed" });
    expect(await compile(job)).toMatchObject({ type: "css" });
  }, 60_000);

  it("reports a failure without details", async () => {
    const outcome = await compileCss(
      {
        type: "compile-css",
        theme: { ...DEFAULT_THEME, preset: "light" },
        candidates: [],
        families: [],
      },
      () => Promise.reject(new Error("no resources")),
    );

    expect(outcome).toEqual({ type: "css-failed" });
  });
});
