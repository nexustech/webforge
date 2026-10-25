import { DEFAULT_THEME } from "@webforge/model";
import { entranceClasses, hoverClasses } from "@webforge/site-components";
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
  it("leaves out fonts the catalogue doesn't have: the site shows their fallback", () => {
    const fonts = {
      heading: { family: "Comic Neue", fallback: "sans-serif" },
      body: { family: "Comic Neue", fallback: "sans-serif" },
    } as const;
    const source = siteStylesheetSource({
      theme: { ...DEFAULT_THEME, fonts },
      candidates: [],
      fontsUrl: "../fonts/",
    });

    // The site's own theme, none of daisyUI's (2.1).
    expect(source).toContain('@plugin "daisyui" { themes: false; }');
    expect(source).toContain('name: "light";');
    expect(source).not.toContain("@font-face");
  });

  it("declares each face of the theme's fonts, by weight range and subset (2.2)", () => {
    const source = siteStylesheetSource({
      theme: DEFAULT_THEME,
      candidates: [],
      fontsUrl: "../fonts/",
    });

    // Inter is variable: one file per style and subset, for every weight.
    expect(source).toContain(`@font-face {
  font-family: "Inter";
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url("../fonts/inter-latin-wght-normal.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0131,`);
    expect(source.match(/@font-face/g)).toHaveLength(4);
    expect(source).toContain('url("../fonts/inter-latin-ext-wght-italic.woff2")');
  });
});

describe("buildSiteCss", () => {
  it("hides an entrance only once the page is marked, and only where motion is welcome (2.12)", async () => {
    const candidates =
      `${entranceClasses({ entrance: "slideLeft", entranceDelay: "long" })}${hoverClasses("lift")}`
        .trim()
        .split(" ");
    const css = await buildSiteCss(resources, {
      theme: DEFAULT_THEME,
      candidates,
      fontsUrl: "../fonts/",
    });

    const motionSafe = css.slice(css.indexOf("@media (prefers-reduced-motion: no-preference)"));
    // Only while it waits: once the page is marked, and until it has moved in.
    expect(motionSafe).toMatch(
      /:root\[data-wf-animate\] \.motion-safe\\:wf-waiting\\:opacity-0:not\(\[data-wf-shown\]\) \{\s*opacity: 0%;/,
    );
    expect(motionSafe).toMatch(
      /:root\[data-wf-animate\] \.motion-safe\\:wf-waiting\\:-translate-x-8:not\(\[data-wf-shown\]\)/,
    );
    // Nor any transition while it waits: it moves only on the way in.
    expect(motionSafe).toMatch(
      /\.motion-safe\\:wf-waiting\\:transition-none:not\(\[data-wf-shown\]\) \{\s*transition-property: none;/,
    );
    // Its delay only while it moves in: shown, not yet done.
    expect(motionSafe).toMatch(
      /\.motion-safe\\:wf-entering\\:delay-600\[data-wf-shown\]:not\(\[data-wf-done\]\) \{\s*transition-delay: 600ms;/,
    );
    expect(motionSafe).toContain(String.raw`.motion-safe\:hover\:-translate-y-1:hover`);
  });

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

  it("compiles the colour fields' classes: a theme shade at an opacity, and a hex colour (ADR 0009)", async () => {
    const css = await buildSiteCss(resources, {
      theme: DEFAULT_THEME,
      candidates: classCandidates(
        '<h2 class="site-heading text-primary-300/80"></h2><h3 class="text-[#1f6feb]/50"></h3>',
      ),
      fontsUrl: "../fonts/",
    });

    // As CSS escapes the class names.
    expect(css).toContain(String.raw`.text-primary-300\/80`);
    expect(css).toContain("--wf-color-primary-300");
    expect(css).toContain(String.raw`.text-\[\#1f6feb\]\/50`);
    expect(css).toContain("#1f6feb");
  });

  it("fails when a Tailwind stylesheet is missing from the resources", async () => {
    const options = { theme: DEFAULT_THEME, candidates: [], fontsUrl: "" };

    await expect(buildSiteCss({ ...resources, stylesheets: {} }, options)).rejects.toThrow(
      'Unknown stylesheet "tailwindcss/theme.css"',
    );
  });
});
