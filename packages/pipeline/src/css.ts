import type { ThemeTokens } from "@webforge/model";
import { type FontFace, fontFacesFor, themeCss } from "@webforge/themes";
import { compile } from "tailwindcss";
import type { PipelineResources } from "./resources.js";

/** The resources compiling CSS needs: no image codecs, and no font bytes. */
export type StyleResources = Pick<PipelineResources, "stylesheets" | "daisyui" | "daisyuiTheme">;

/** Options of {@link buildSiteCss}. */
export type SiteCssOptions = {
  /** The site's theme (2.1): its daisyUI theme, fonts, type scale and spacing. */
  readonly theme: ThemeTokens;
  /** Classes found in the site's HTML. */
  readonly candidates: readonly string[];
  /** Path from the CSS file to the fonts folder, e.g. `../fonts/`. */
  readonly fontsUrl: string;
};

/**
 * An `@font-face` for each of `faces` (2.2): a variable font's weight range, and the subset's
 * characters, so a browser loads only the files a page's text needs. Every value comes from the
 * catalogue's schema, so none can carry other CSS.
 */
function fontFaces(faces: readonly FontFace[], fontsUrl: string): string {
  return faces
    .map(
      (face) => `@font-face {
  font-family: "${face.family}";
  font-style: ${face.style};
  font-weight: ${typeof face.weight === "number" ? face.weight : face.weight.join(" ")};
  font-display: swap;
  src: url("${fontsUrl}${face.file}") format("woff2");
  unicode-range: ${face.unicodeRange.replaceAll(",", ", ")};
}`,
    )
    .join("\n");
}

/**
 * The Tailwind entry stylesheet: theme, base styles and utilities, daisyUI with the site's theme,
 * and the fonts its theme uses. No `@import "tailwindcss"`: each layer is loaded from the resources.
 */
export function siteStylesheetSource(options: SiteCssOptions): string {
  return [
    "@layer theme, base, components, utilities;",
    '@import "tailwindcss/theme.css" layer(theme);',
    '@import "tailwindcss/preflight.css" layer(base);',
    '@import "tailwindcss/utilities.css" layer(utilities);',
    themeCss(options.theme),
    fontFaces(fontFacesFor(options.theme), options.fontsUrl),
  ]
    .filter((part) => part !== "")
    .join("\n");
}

/**
 * Compiles the site's CSS with Tailwind v4 and daisyUI, from the classes the pages actually use.
 * The output stays readable (X4): no minification.
 */
export async function buildSiteCss(
  resources: StyleResources,
  options: SiteCssOptions,
): Promise<string> {
  const compiler = await compile(siteStylesheetSource(options), {
    base: "/",
    loadStylesheet: async (id, base) => {
      const content = resources.stylesheets[id];
      if (content === undefined) {
        throw new Error(`Unknown stylesheet "${id}"`);
      }
      return { path: id, base, content };
    },
    loadModule: async (id, base) => {
      // daisyUI, and its custom-theme plugin for the site's own theme (2.1).
      const module =
        id === "daisyui"
          ? resources.daisyui
          : id === "daisyui/theme"
            ? resources.daisyuiTheme
            : null;
      if (module === null) {
        throw new Error(`Unknown Tailwind plugin "${id}"`);
      }
      return { path: id, base, module: module as never };
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
        // React escapes `&`, `<`, `>` and quotes in attributes; Tailwind needs the raw class name
        // (`[&:focus-within>ul]:block`). `&amp;` last, so `&amp;gt;` stays `&gt;`.
        candidates.add(
          name
            .replaceAll("&lt;", "<")
            .replaceAll("&gt;", ">")
            .replaceAll("&quot;", '"')
            .replaceAll("&#x27;", "'")
            .replaceAll("&amp;", "&"),
        );
      }
    }
  }
  return [...candidates].sort();
}
