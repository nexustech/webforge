import { DEFAULT_THEME } from "@webforge/model";
import { beforeAll, describe, expect, it } from "vitest";
import { buildSiteCss, classCandidates, siteStylesheetSource } from "./css.js";
import { loadNodeResources } from "./node-resources.js";
import type { PipelineResources } from "./resources.js";

let resources: PipelineResources;

beforeAll(async () => {
  resources = await loadNodeResources();
});

describe("classCandidates", () => {
  it("collects the words of every class attribute once, unescaping &amp;", () => {
    const html =
      '<div class="btn  btn-primary"><p class="btn [&amp;_a]:underline">x</p><i class=""></i></div>';

    expect(classCandidates(html)).toEqual(["[&_a]:underline", "btn", "btn-primary"]);
  });

  it("unescapes every character React escapes, so arbitrary variants reach Tailwind", () => {
    const html = '<li class="[&amp;:not([data-wf-ready]):focus-within&gt;ul]:block"></li>';

    expect(classCandidates(html)).toEqual(["[&:not([data-wf-ready]):focus-within>ul]:block"]);
  });

  it("ignores attributes that only end in class", () => {
    expect(classCandidates('<div data-class="nope" class="yes"></div>')).toEqual(["yes"]);
  });
});

describe("siteStylesheetSource", () => {
  it("leaves out fonts when there are none", () => {
    const source = siteStylesheetSource(
      { ...resources, fonts: [] },
      { theme: DEFAULT_THEME, candidates: [], fontsUrl: "../fonts/" },
    );

    // The site's own theme, none of daisyUI's (2.1).
    expect(source).toContain('@plugin "daisyui" { themes: false; }');
    expect(source).toContain('name: "light";');
    expect(source).not.toContain("@font-face");
  });
});

describe("buildSiteCss", () => {
  it("compiles only the candidates it is given, with the site's theme", async () => {
    const css = await buildSiteCss(resources, {
      theme: { ...DEFAULT_THEME, preset: "dracula" },
      candidates: ["btn", "py-16"],
      fontsUrl: "../fonts/",
    });

    expect(css).toContain('[data-theme="dracula"]');
    expect(css).toContain(".py-16");
    expect(css).toContain(".btn");
    expect(css).not.toContain(".py-24");
  });

  it("fails when a Tailwind stylesheet is missing from the resources", async () => {
    const options = { theme: DEFAULT_THEME, candidates: [], fontsUrl: "" };

    await expect(buildSiteCss({ ...resources, stylesheets: {} }, options)).rejects.toThrow(
      'Unknown stylesheet "tailwindcss/theme.css"',
    );
  });
});
