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

  it("ignores attributes that only end in class", () => {
    expect(classCandidates('<div data-class="nope" class="yes"></div>')).toEqual(["yes"]);
  });
});

describe("siteStylesheetSource", () => {
  it("leaves out fonts when there are none", () => {
    const source = siteStylesheetSource(
      { ...resources, fonts: [] },
      { theme: "light", candidates: [], fontsUrl: "../fonts/" },
    );

    expect(source).toContain('@plugin "daisyui" { themes: light --default; }');
    expect(source).not.toContain("@font-face");
    expect(source).not.toContain("--font-sans");
  });
});

describe("buildSiteCss", () => {
  it("compiles only the candidates it is given, with the chosen theme", async () => {
    const css = await buildSiteCss(resources, {
      theme: "dracula",
      candidates: ["btn", "py-16"],
      fontsUrl: "../fonts/",
    });

    expect(css).toContain("[data-theme=dracula]");
    expect(css).toContain(".py-16");
    expect(css).toContain(".btn");
    expect(css).not.toContain(".py-24");
  });

  it("fails when a Tailwind stylesheet is missing from the resources", async () => {
    const options = { theme: "light", candidates: [], fontsUrl: "" };

    await expect(buildSiteCss({ ...resources, stylesheets: {} }, options)).rejects.toThrow(
      'Unknown stylesheet "tailwindcss/theme.css"',
    );
  });
});
