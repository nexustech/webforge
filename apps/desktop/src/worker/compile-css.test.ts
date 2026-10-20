import { loadNodeResources } from "@webforge/pipeline/node";
import { describe, expect, it } from "vitest";
import { compileCss } from "./compile-css.js";

describe("compileCss", () => {
  it("compiles the classes the site uses, the body's classes and the theme", async () => {
    const outcome = await compileCss(
      { type: "compile-css", id: 7, theme: { name: "light" }, candidates: ["btn", "text-4xl"] },
      loadNodeResources,
    );

    expect(outcome).toMatchObject({ type: "css", id: 7 });
    if (outcome.type !== "css") return;
    expect(outcome.css).toContain(".btn");
    expect(outcome.css).toContain(".text-4xl");
    // The body classes of exported pages, so the canvas looks like the export.
    expect(outcome.bodyClass).toContain("bg-base-100");
    expect(outcome.css).toContain(".bg-base-100");
    // Fonts point at the placeholder the renderer replaces with its own font files.
    expect(outcome.css).toContain('url("webforge-font:inter-latin-400-normal.woff2")');
    // Classes the site doesn't use aren't compiled.
    expect(outcome.css).not.toContain(".text-9xl");
  }, 60_000);

  it("reports a failure without details", async () => {
    const outcome = await compileCss(
      { type: "compile-css", id: 3, theme: { name: "light" }, candidates: [] },
      () => Promise.reject(new Error("no resources")),
    );

    expect(outcome).toEqual({ type: "css-failed", id: 3 });
  });
});
