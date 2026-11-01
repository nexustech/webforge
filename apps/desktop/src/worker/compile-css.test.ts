import { DEFAULT_THEME } from "@webforge/model";
import { loadNodeResources } from "@webforge/pipeline/node";
import type { CatalogueFont } from "@webforge/themes";
import { describe, expect, it } from "vitest";
import { compileCss } from "./compile-css.js";

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
