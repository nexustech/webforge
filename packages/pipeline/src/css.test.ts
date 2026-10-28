import { DEFAULT_THEME, TEXT_MARK_CLASSES } from "@webforge/model";
import {
  appearanceBoxClasses,
  EDITOR_RENDER_CONTEXT,
  entranceClasses,
  hoverClasses,
  renderNodesToHtml,
  siteLibrary,
} from "@webforge/site-components";
import { beforeAll, describe, expect, it } from "vitest";
import { buildSiteCss, classCandidates, createStyleCompiler, siteStylesheetSource } from "./css.js";
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
  it("styles Style this ‹component›…'s deeper choices from the theme's tokens (3.13b)", async () => {
    const candidates = appearanceBoxClasses({
      lookGradientDirection: "toBottomRight",
      lookGradientFrom: "primary",
      lookGradientTo: "secondary-300",
      lookBorderBottom: "thick",
      lookBorderStyle: "dashed",
      lookCornerTopLeft: "large",
      lookShadow: "medium",
      lookShadowInner: true,
      lookPadding: "l",
      lookHoverColor: "accent",
    }).split(" ");
    const css = await buildSiteCss(resources, {
      theme: DEFAULT_THEME,
      candidates,
      fontsUrl: "../fonts/",
    });

    // Every class has its rule, and none is a style written on the element.
    for (const name of candidates) {
      expect(css, name).toContain(`.${name.replaceAll(":", "\\:").replaceAll("!", "\\!")}`);
    }
    // The colours and corners are the theme's variables: a theme switch restyles them.
    expect(css).toMatch(/--tw-gradient-from: var\(--color-primary\)/);
    expect(css).toMatch(/border-top-left-radius: var\(--radius-box\)/);
    expect(css).toMatch(/background-color: var\(--color-accent\)/);

    // A theme without shadows has no inner ones either.
    const flat = await buildSiteCss(resources, {
      theme: { ...DEFAULT_THEME, shadow: "none" },
      candidates,
      fontsUrl: "../fonts/",
    });
    // Tailwind writes the theme's value into the rule: an inner shadow of nothing.
    expect(flat).toContain("--tw-inset-shadow: inset 0 0 var(--tw-inset-shadow-color, #0000)");
    expect(css).not.toContain("--tw-inset-shadow: inset 0 0 var(--tw-inset-shadow-color, #0000)");
  });

  it("hides an entrance only once the page is marked, and only where motion is welcome (2.12)", async () => {
    const candidates =
      `${entranceClasses({ entrance: "slideLeft", entranceDelay: "long" })}${hoverClasses({ hover: "lift", hoverSpeed: "slow", hoverEasing: "springy" })}`
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
    // Its transition too (2.28), so after it a hover's is the element's only one.
    expect(motionSafe).toMatch(
      /\.motion-safe\\:wf-entering\\:duration-700\[data-wf-shown\]:not\(\[data-wf-done\]\) \{\s*--tw-duration: 700ms;/,
    );
    expect(motionSafe).toContain(String.raw`.motion-safe\:hover\:-translate-y-1:hover`);
    // The hover's speed and Springy movement (2.28), from the theme's token.
    expect(motionSafe).toMatch(/\.motion-safe\\:duration-500 \{\s*--tw-duration: 500ms;/);
    expect(motionSafe).toMatch(/\.motion-safe\\:ease-spring \{\s*--tw-ease: var\(--ease-spring\);/);
    expect(css).toContain("--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);");
  });

  it("compiles the text marks' classes from the theme, as rich text carries them (2.25, ST-3)", async () => {
    const html = `<p><u>Read</u> <span class="bg-secondary/30">this</span> <span class="text-primary">now</span></p>`;
    const css = await buildSiteCss(resources, {
      theme: DEFAULT_THEME,
      candidates: classCandidates(html),
      fontsUrl: "../fonts/",
    });

    // The theme's colours, by their variables: a theme switch changes them.
    const rule = (selector: string) =>
      css.slice(css.indexOf(selector), css.indexOf("}", css.indexOf(selector)));
    expect(rule(String.raw`.bg-secondary\/30 {`)).toContain("var(--color-secondary)");
    expect(rule(".text-primary {")).toContain("var(--color-primary)");
    for (const name of TEXT_MARK_CLASSES) {
      expect(classCandidates(`<span class="${name}"></span>`)).toEqual([name]);
    }
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

describe("the Appearance group's classes (2.22, ST-1)", () => {
  /** The rule for `selector` (as CSS escapes it) in `css`, from it to its closing brace. */
  const rule = (css: string, selector: string) => {
    const at = css.indexOf(`${selector} {`);
    return at === -1 ? "" : css.slice(at, css.indexOf("}", at) + 1);
  };

  /** The site's CSS for `nodes`, as the export compiles it. */
  async function cssFor(nodes: Parameters<typeof renderNodesToHtml>[0]) {
    const html = renderNodesToHtml(nodes, siteLibrary, EDITOR_RENDER_CONTEXT);
    return {
      html,
      css: await buildSiteCss(resources, {
        theme: DEFAULT_THEME,
        candidates: classCandidates(html),
        fontsUrl: "../fonts/",
      }),
    };
  }

  it("wins over the component's own classes, at any order, and per device", async () => {
    const { html, css } = await cssFor([
      {
        type: "Section",
        props: {
          id: "band",
          content: [
            {
              type: "Heading",
              props: {
                id: "h",
                text: "Fresh bread",
                size: "medium",
                lookSize: { $responsive: { desktop: "h1", tablet: "h1", mobile: "h3" } },
                lookUnderline: true,
              },
            },
          ],
        },
      },
    ]);
    // The Heading's own size class is there too; the person's choice is marked to win over it.
    expect(html).toMatch(
      /class="site-heading [^"]*text-h2[^"]* max-md:text-h3! md:text-h1! underline!"/,
    );
    expect(rule(css, String.raw`.max-md\:text-h3\!`)).toContain("!important");
    expect(rule(css, String.raw`.underline\!`)).toContain(
      "text-decoration-line: underline !important",
    );
    // Tablet's value from Tablet's width up, marked to win too.
    const tablet = css.indexOf(String.raw`.md\:text-h1\!`);
    expect(tablet).toBeGreaterThan(-1);
    expect(css.lastIndexOf("@media (width >= 48rem)", tablet)).toBeGreaterThan(-1);
    expect(rule(css, String.raw`.md\:text-h1\!`)).toContain("!important");
  });

  it("keeps a focus ring with a shadow, and a reversed section's colours as the theme's", async () => {
    const { html, css } = await cssFor([
      {
        type: "CallToAction",
        props: {
          id: "cta",
          colors: "inverse",
          lookShadow: "large",
          lookColor: "primary",
          buttonLabel: "Book",
          buttonLink: "about",
        },
      },
    ]);
    // A shadow composes with the rings Tailwind draws focus with, rather than replacing them.
    expect(rule(css, String.raw`.shadow-lg\!`)).toContain("var(--tw-ring-shadow)");
    // The colour is the theme's variable, which a reversed section's `data-theme` redefines.
    expect(html).toContain('data-theme="wf_inverse"');
    expect(rule(css, String.raw`.text-primary\!`)).toContain(
      "color: var(--color-primary) !important",
    );
    // The section's button is drawn by daisyUI as ever, its own states included: the Appearance
    // classes are on the section, not on it.
    expect(html).toMatch(/<a class="btn btn-primary[^"!]*"/);
  });

  it("lets the hover row beat the group's own shadow (2.22, ST-2)", async () => {
    const { html, css } = await cssFor([
      {
        type: "Section",
        props: {
          id: "band",
          content: [
            {
              type: "Button",
              props: {
                id: "b",
                label: "Book",
                link: "about",
                lookShadow: "small",
                hover: "shadow",
              },
            },
          ],
        },
      },
    ]);
    expect(html).toMatch(/class="[^"]*hover:shadow-\(--wf-hover-shadow\)! [^"]*shadow-sm!"/);
    const base = css.indexOf(String.raw`.shadow-sm\!`);
    const hover = css.indexOf(String.raw`.hover\:shadow-\(--wf-hover-shadow\)\!:hover`);
    // Both marked to win, and the hover state written after the base: it wins while hovered.
    expect(base).toBeGreaterThan(-1);
    expect(hover).toBeGreaterThan(base);
    expect(rule(css, String.raw`.hover\:shadow-\(--wf-hover-shadow\)\!:hover`)).toContain(
      "!important",
    );
  });

  it("leaves a form's button its own disabled state: the group styles the form's root only", () => {
    const html = renderNodesToHtml(
      [
        {
          type: "Newsletter",
          props: { id: "news", lookBackground: "base-200", lookShadow: "large" },
        },
      ],
      siteLibrary,
      EDITOR_RENDER_CONTEXT,
    );
    // Nowhere to send: the button is disabled, with daisyUI's classes and none of the group's.
    expect(html).toMatch(/<button[^>]*disabled[^>]*>/);
    expect(html.match(/<button[^>]*>/)?.[0]).not.toContain("!");
    expect(html).toMatch(/<section class="site-newsletter[^"]*bg-base-200! shadow-lg!"/);
  });
});

describe("createStyleCompiler (3.1)", () => {
  const options = (candidates: readonly string[], theme = DEFAULT_THEME) => ({
    theme,
    candidates,
    fontsUrl: "../fonts/",
  });
  const some = ["btn", "p-4", "md:grid-cols-3", "text-[#1f6feb]/50"];
  const more = [...some, "skew-x-12", "hover:underline"];

  it("compiles exactly what buildSiteCss does, as classes come and go", async () => {
    const styles = createStyleCompiler(resources);

    // The kept compiler for the first two; a fresh one once a class is gone, and for a new theme.
    for (const [candidates, theme] of [
      [some, DEFAULT_THEME],
      [more, DEFAULT_THEME],
      [some, DEFAULT_THEME],
      [some, { ...DEFAULT_THEME, preset: "dark" as const }],
    ] as const) {
      expect(await styles.css(options(candidates, theme))).toBe(
        await buildSiteCss(resources, options(candidates, theme)),
      );
    }
  });

  it("keeps a class no page uses any more while it grows, for a preview", async () => {
    const styles = createStyleCompiler(resources);
    await styles.css(options(more), true);

    const css = await styles.css(options(some), true);

    expect(css).toContain(".skew-x-12");
    // An export after it is exact again.
    expect(await styles.css(options(some))).not.toContain(".skew-x-12");
  });
});
