import type { ThemeTokens } from "@webforge/model";
import { type CatalogueFont, type FontFace, fontFacesFor, themeCss } from "@webforge/themes";
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
  /** The font families there are files for; see {@link PipelineResources.fonts}. */
  readonly fonts?: readonly CatalogueFont[];
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
 * With `tailwind: "package"`, the same stylesheet as a developer rebuilds it with Tailwind's CLI
 * from the `tailwindcss` package, reading the classes from the exported pages (developer files, X6).
 */
export function siteStylesheetSource(
  options: SiteCssOptions,
  tailwind: "bundled" | "package" = "bundled",
): string {
  return [
    ...(tailwind === "bundled"
      ? [
          "@layer theme, base, components, utilities;",
          '@import "tailwindcss/theme.css" layer(theme);',
          '@import "tailwindcss/preflight.css" layer(base);',
          '@import "tailwindcss/utilities.css" layer(utilities);',
        ]
      : ['@import "tailwindcss" source(none);', '@source "../**/*.html";']),
    // An element waiting for its entrance animation (2.12, `entranceClasses` in site-components):
    // once webforge.js has marked the page, until it has moved in.
    "@custom-variant wf-waiting (:root[data-wf-animate] &:not([data-wf-shown]));",
    // ...and while it moves in, which its delay applies to, not to later changes.
    "@custom-variant wf-entering (&[data-wf-shown]:not([data-wf-done]));",
    themeCss(options.theme),
    fontFaces(fontFacesFor(options.theme, options.fonts), options.fontsUrl),
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
  const compiler = await compile(siteStylesheetSource(options), tailwindLoaders(resources));
  return compiler.build([...options.candidates]);
}

/**
 * Compiles the site's CSS like {@link buildSiteCss}, keeping its Tailwind compiler between builds
 * (3.1): preparing one takes about 100 ms, building from it a few.
 */
export type StyleCompiler = {
  /**
   * The CSS for `options`. A Tailwind compiler only ever adds the classes it is given to its CSS,
   * so with `grow` (a preview, 3.2) a class no page uses any more stays in until the theme changes.
   * Without it (an export), the CSS is always exactly {@link buildSiteCss}'s: the kept compiler is
   * used only when none of the classes it has seen are gone.
   */
  css(options: SiteCssOptions, grow?: boolean): Promise<string>;
};

/** A {@link StyleCompiler} over `resources`, which must stay the same for its lifetime. */
export function createStyleCompiler(resources: StyleResources): StyleCompiler {
  let kept:
    | {
        readonly source: string;
        readonly compiler: Awaited<ReturnType<typeof compile>>;
        readonly seen: Set<string>;
      }
    | undefined;
  return {
    async css(options, grow = false) {
      const source = siteStylesheetSource(options);
      const wanted = new Set(options.candidates);
      // Checked and built in one go, with no await between: another build can't change it meanwhile.
      const reusable =
        kept !== undefined &&
        kept.source === source &&
        (grow || [...kept.seen].every((name) => wanted.has(name)));
      const current =
        reusable && kept !== undefined
          ? kept
          : {
              source,
              compiler: await compile(source, tailwindLoaders(resources)),
              seen: new Set<string>(),
            };
      kept = current;
      for (const name of wanted) current.seen.add(name);
      return current.compiler.build([...options.candidates]);
    },
  };
}

/**
 * How Tailwind gets the stylesheets and plugins the site's stylesheet names: from `resources`,
 * never from disk or the network. Shared with the class catalogue (class-catalogue.ts).
 */
export function tailwindLoaders(resources: StyleResources) {
  return {
    base: "/",
    loadStylesheet: async (id: string, base: string) => {
      const content = resources.stylesheets[id];
      if (content === undefined) {
        throw new Error(`Unknown stylesheet "${id}"`);
      }
      return { path: id, base, content };
    },
    loadModule: async (id: string, base: string) => {
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
  };
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
