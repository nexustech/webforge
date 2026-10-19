import { compile } from "tailwindcss";
import type { FontFile, PipelineResources } from "./resources.js";

/** Options of {@link buildSiteCss}. */
export type SiteCssOptions = {
  /** daisyUI theme name, used as the site's default theme (`data-theme`). */
  readonly theme: string;
  /** Classes found in the site's HTML. */
  readonly candidates: readonly string[];
  /** Path from the CSS file to the fonts folder, e.g. `../fonts/`. */
  readonly fontsUrl: string;
};

function fontFaces(fonts: readonly FontFile[], fontsUrl: string): string {
  return fonts
    .map(
      (font) => `@font-face {
  font-family: "${font.family}";
  font-style: normal;
  font-weight: ${font.weight};
  font-display: swap;
  src: url("${fontsUrl}${font.fileName}") format("woff2");
}`,
    )
    .join("\n");
}

/**
 * The Tailwind entry stylesheet: theme, base styles and utilities, daisyUI with the site's theme,
 * and the bundled fonts. No `@import "tailwindcss"`: each layer is loaded from the resources.
 */
export function siteStylesheetSource(
  resources: PipelineResources,
  options: SiteCssOptions,
): string {
  const family = resources.fonts[0]?.family;
  return [
    "@layer theme, base, components, utilities;",
    '@import "tailwindcss/theme.css" layer(theme);',
    '@import "tailwindcss/preflight.css" layer(base);',
    '@import "tailwindcss/utilities.css" layer(utilities);',
    `@plugin "daisyui" { themes: ${options.theme} --default; }`,
    family === undefined
      ? ""
      : `@theme { --font-sans: "${family}", ui-sans-serif, system-ui, sans-serif; }`,
    fontFaces(resources.fonts, options.fontsUrl),
  ]
    .filter((part) => part !== "")
    .join("\n");
}

/**
 * Compiles the site's CSS with Tailwind v4 and daisyUI, from the classes the pages actually use.
 * The output stays readable (X4): no minification.
 */
export async function buildSiteCss(
  resources: PipelineResources,
  options: SiteCssOptions,
): Promise<string> {
  const compiler = await compile(siteStylesheetSource(resources, options), {
    base: "/",
    loadStylesheet: async (id, base) => {
      const content = resources.stylesheets[id];
      if (content === undefined) {
        throw new Error(`Unknown stylesheet "${id}"`);
      }
      return { path: id, base, content };
    },
    loadModule: async (id, base) => {
      if (id !== "daisyui") {
        throw new Error(`Unknown Tailwind plugin "${id}"`);
      }
      return { path: id, base, module: resources.daisyui as never };
    },
  });
  return compiler.build([...options.candidates]);
}

/** The classes used in `html`: every word of every `class` attribute, without duplicates. */
export function classCandidates(html: string): string[] {
  const candidates = new Set<string>();
  for (const match of html.matchAll(/\sclass="([^"]*)"/g)) {
    for (const name of (match[1] ?? "").split(/\s+/)) {
      if (name !== "") {
        // React escapes `&` in attributes; Tailwind needs the raw class name.
        candidates.add(name.replaceAll("&amp;", "&"));
      }
    }
  }
  return [...candidates].sort();
}
