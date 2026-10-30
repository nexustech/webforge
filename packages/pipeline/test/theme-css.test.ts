import {
  COLOR_ROLES,
  createSite,
  DEFAULT_THEME,
  migrateSite,
  type ThemeTokens,
  themeTokensSchema,
} from "@webforge/model";
import { scaledTestTimeout } from "@webforge/test-utils/vitest";
import { THEME_PRESETS, themeCss } from "@webforge/themes";
import daisyThemes from "daisyui/theme/object.js";
import fc from "fast-check";
import { compile } from "tailwindcss";
import { beforeAll, describe, expect, it } from "vitest";
import { buildSiteCss } from "../src/css.js";
import { loadNodeResources } from "../src/node-resources.js";
import type { PipelineResources } from "../src/resources.js";

// The site's CSS from its theme tokens (2.1): what daisyUI's own themes gave before must come out
// the same, and every theme the model accepts must compile.

let resources: PipelineResources;

beforeAll(async () => {
  resources = await loadNodeResources();
});

/** The variables daisyUI's block for the theme named `name` in `css` sets, by name. */
function themeVariables(css: string, name: string): Record<string, string> {
  // The theme's own block sets its colour scheme; the shades' block of the same name doesn't.
  const body = [...css.matchAll(new RegExp(`\\[data-theme="?${name}"?\\] \\{([^}]*)\\}`, "g"))]
    .map((match) => match[1] ?? "")
    .find((block) => block.includes("color-scheme:"));
  if (body === undefined) throw new Error(`No theme ${name} in the CSS`);
  return Object.fromEntries(
    [...body.matchAll(/(--[a-z0-9-]+|color-scheme): ([^;]+);/g)].map((match) => [
      match[1],
      match[2]?.trim(),
    ]),
  );
}

/** daisyUI's built-in theme `name`, compiled as Webforge did before 2.1. */
async function builtIn(name: string): Promise<string> {
  const compiler = await compile(
    [
      "@layer theme, base, components, utilities;",
      '@import "tailwindcss/theme.css" layer(theme);',
      `@plugin "daisyui" { themes: ${name} --default; }`,
    ].join("\n"),
    {
      base: "/",
      loadStylesheet: async (id, base) => ({
        path: id,
        base,
        content: resources.stylesheets[id] ?? "",
      }),
      loadModule: async (id, base) => ({ path: id, base, module: resources.daisyui as never }),
    },
  );
  return compiler.build([]);
}

/** A format 4 site whose theme was daisyUI's `name`, as format 5 opens it. */
function migrated(name: string): ThemeTokens {
  const site = createSite({ name: "R", language: "en", homeTitle: "Home", notFoundTitle: "404" });
  return migrateSite({ ...site, formatVersion: 4, theme: { name } }).theme;
}

const css = (theme: ThemeTokens) =>
  buildSiteCss(resources, { theme, candidates: ["btn"], fontsUrl: "../fonts/" });

describe("themeCss in the site's stylesheet (2.1)", () => {
  it.each(Object.keys(daisyThemes))(
    "styles a site migrated from daisyUI's %s as daisyUI did",
    async (name) => {
      const before = themeVariables(await builtIn(name), name);
      const after = themeVariables(await css(migrated(name)), name);

      expect(after).toEqual(before);
    },
  );

  it("gives sections that invert the page a theme of their own", async () => {
    const compiled = await css(DEFAULT_THEME);

    const dark = themeVariables(compiled, "wf_inverse");
    expect(dark["color-scheme"]).toBe("dark");
    expect(Object.keys(dark).filter((key) => key.startsWith("--color-"))).toHaveLength(
      COLOR_ROLES.length,
    );
    // No built-in theme is left.
    expect(compiled).not.toMatch(/\[data-theme="?cupcake"?\]/);
  });

  it("makes the fonts, the spacing unit and the type scale Tailwind's", async () => {
    const theme: ThemeTokens = {
      ...DEFAULT_THEME,
      fonts: {
        heading: { family: "Playfair Display", fallback: "serif" },
        body: { family: "Lora", fallback: "serif" },
        accent: { family: "Playfair Display", fallback: "serif" },
      },
      spacing: "roomy",
    };
    const compiler = await buildSiteCss(resources, {
      theme,
      candidates: ["font-heading", "text-h1", "p-4"],
      fontsUrl: "",
    });

    expect(compiler).toContain('--font-sans: "Lora", ui-serif, Georgia, serif;');
    expect(compiler).toContain('--font-heading: "Playfair Display", ui-serif, Georgia, serif;');
    expect(compiler).toContain("--spacing: 0.275rem;");
    expect(compiler).toMatch(/\.text-h1 \{[^}]*var\(--text-h1\)/);
    expect(compiler).toContain("--text-h1: 3rem;");
  });

  it("gives shades, opacities and hex colours classes, and quotes any font's name", async () => {
    const theme: ThemeTokens = {
      ...DEFAULT_THEME,
      fonts: {
        ...DEFAULT_THEME.fonts,
        heading: { family: "Rock 'n' Roll One", fallback: "sans-serif" },
      },
    };
    const compiled = await buildSiteCss(resources, {
      theme,
      candidates: ["bg-primary-300/80", "text-[#1f6feb]/50", "font-heading"],
      fontsUrl: "",
    });

    // A role's shade is read where it is used, so it follows inverse sections.
    const shade = compiled.slice(compiled.indexOf(".bg-primary-300\\/80 {"));
    expect(shade.slice(0, shade.indexOf("}"))).toContain("var(--wf-color-primary-300)");
    expect(compiled).toMatch(/\[data-theme="wf_inverse"\] \{[^}]*--wf-color-primary-300: /);
    // A field's own hex colour is an arbitrary class, the same in every theme.
    expect(compiled).toMatch(/\.text-\\\[\\#1f6feb\\\]\\\/50 \{[^}]*#1f6feb/);
    expect(compiled).toContain(
      `--font-heading: "Rock 'n' Roll One", ui-sans-serif, system-ui, sans-serif;`,
    );
  });

  it(
    "compiles every theme the model accepts",
    async () => {
      const color = fc.record({
        l: fc.double({ min: 0, max: 1, noNaN: true }),
        c: fc.double({ min: 0, max: 0.5, noNaN: true }),
        h: fc.double({ min: 0, max: 360, noNaN: true }),
      });
      const theme = fc
        .record({
          preset: fc.stringMatching(/^[a-z][a-z0-9-]{0,20}$/),
          colors: fc.record(Object.fromEntries(COLOR_ROLES.map((role) => [role, color]))),
          scheme: fc.constantFrom("light", "dark"),
          border: fc.constantFrom("thin", "thick"),
          spacing: fc.constantFrom("compact", "normal", "roomy"),
          shadow: fc.constantFrom("none", "soft", "strong"),
        })
        .map((parts) => themeTokensSchema.parse({ ...DEFAULT_THEME, ...parts }));

      await fc.assert(
        fc.asyncProperty(theme, async (tokens) => {
          const compiled = await css(tokens);
          expect(themeVariables(compiled, tokens.preset)["color-scheme"]).toBe(tokens.scheme);
        }),
        // Each run compiles a whole stylesheet.
        { numRuns: 15 },
      );
    },
    scaledTestTimeout(60_000),
  );

  it.each(THEME_PRESETS.map((preset) => [preset.preset, preset] as const))(
    "writes the %s preset's theme as reviewed",
    async (name, preset) => {
      await expect(themeCss(preset)).toMatchFileSnapshot(`golden/themes/${name}.css`);
    },
  );
});
