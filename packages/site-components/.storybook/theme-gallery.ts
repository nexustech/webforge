import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { ThemeTokens } from "@webforge/model";
import { type FontFace, fontFacesFor, THEME_PRESETS, themeCss } from "@webforge/themes";
import type { Plugin } from "vite";

/** Where each preset's stylesheet and the fonts they use are written (ignored by git). */
const THEMES_DIR = join(import.meta.dirname, "themes");

/** The module the theme stories import: each preset's compiled CSS, by preset name. */
const MODULE = "virtual:webforge-theme-css";

/** The module the preview imports (2.16): a loader of each preset's compiled CSS, by name. */
const LAZY_MODULE = "virtual:webforge-theme-css/lazy";

/** The font packages are the pipeline's dependencies, as the desktop app's bundled fonts are. */
const fromPipeline = createRequire(join(import.meta.dirname, "../../pipeline/package.json"));

/**
 * An `@font-face` for each of `faces`, as the pipeline writes them (`fontFaces` in its css.ts),
 * pointing at the copies beside the stylesheet.
 */
function fontFaces(faces: readonly FontFace[]): string {
  return faces
    .map(
      (face) => `@font-face {
  font-family: "${face.family}";
  font-style: ${face.style};
  font-weight: ${typeof face.weight === "number" ? face.weight : face.weight.join(" ")};
  font-display: swap;
  src: url("./fonts/${face.file}") format("woff2");
  unicode-range: ${face.unicodeRange.replaceAll(",", ", ")};
}`,
    )
    .join("\n");
}

/**
 * `preset`'s stylesheet as an export's would be (`siteStylesheetSource` in the pipeline): Tailwind,
 * the entrance-animation variants, the theme and its fonts, and the sources in sources.css, so
 * every class a component can use is there.
 */
function stylesheet(preset: ThemeTokens, sources: readonly string[]): string {
  return [
    '@import "tailwindcss";',
    "@custom-variant wf-waiting (:root[data-wf-animate] &:not([data-wf-shown]));",
    "@custom-variant wf-entering (&[data-wf-shown]:not([data-wf-done]));",
    themeCss(preset),
    ...sources,
    fontFaces(fontFacesFor(preset)),
  ].join("\n");
}

/**
 * Writes a stylesheet for each preset into `themes/`, with the font files it uses beside it: the
 * theme stories (2.13) show a whole page in each, in an iframe of its own, and every other story
 * is shown in the preset the toolbar chooses (2.16), as a theme's `@theme` settings (fonts,
 * spacing, type scale) apply to the whole page they're in.
 */
export function writeThemeStylesheets(): void {
  rmSync(THEMES_DIR, { recursive: true, force: true });
  mkdirSync(join(THEMES_DIR, "fonts"), { recursive: true });
  // sources.css's sources, one folder further from src.
  const sources = readFileSync(join(import.meta.dirname, "sources.css"), "utf8")
    .split("\n")
    .filter((line) => line.startsWith("@source"))
    .map((line) => line.replace('"../src"', '"../../src"'));
  for (const preset of THEME_PRESETS) {
    for (const face of fontFacesFor(preset)) {
      copyFileSync(
        fromPipeline.resolve(`${face.package}/files/${face.file}`),
        join(THEMES_DIR, "fonts", face.file),
      );
    }
    writeFileSync(join(THEMES_DIR, `${preset.preset}.css`), stylesheet(preset, sources));
  }
}

/**
 * The modules of each preset's stylesheet, compiled by Tailwind's Vite plugin (`?inline`, so its
 * fonts become assets): `virtual:webforge-theme-css` has every one, for the theme stories, and
 * `virtual:webforge-theme-css/lazy` a loader for each, so a story loads only its own (2.16).
 */
export function themeGallery(): Plugin {
  const names = THEME_PRESETS.map((preset) => preset.preset);
  const path = (name: string) =>
    JSON.stringify(`${join(THEMES_DIR, `${name}.css`).replaceAll("\\", "/")}?inline`);
  return {
    name: "webforge:theme-gallery",
    resolveId: (id) => (id === MODULE || id === LAZY_MODULE ? `\0${id}` : undefined),
    load(id) {
      if (id === `\0${MODULE}`) {
        return [
          ...names.map((name, at) => `import css${at} from ${path(name)};`),
          `export default { ${names.map((name, at) => `${JSON.stringify(name)}: css${at}`).join(", ")} };`,
        ].join("\n");
      }
      if (id === `\0${LAZY_MODULE}`) {
        const loaders = names.map(
          (name) => `${JSON.stringify(name)}: () => import(${path(name)}).then((m) => m.default)`,
        );
        return `export default { ${loaders.join(", ")} };`;
      }
      return undefined;
    },
  };
}
