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
 * the entrance-animation variants, the theme and its fonts, and the sources preview.css scans, so
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
 * Writes a stylesheet for each preset into `themes/`, with the font files it uses beside it, for
 * the theme stories (2.13): each shows a whole page in one theme, in an iframe of its own, as a
 * theme's `@theme` settings (fonts, spacing, type scale) apply to the whole page they're in.
 */
export function writeThemeStylesheets(): void {
  rmSync(THEMES_DIR, { recursive: true, force: true });
  mkdirSync(join(THEMES_DIR, "fonts"), { recursive: true });
  // preview.css's sources, one folder further from src.
  const sources = readFileSync(join(import.meta.dirname, "preview.css"), "utf8")
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
 * The module the theme stories import (`virtual:webforge-theme-css`): each preset's stylesheet,
 * compiled by Tailwind's Vite plugin like preview.css (`?inline`, so its fonts become assets).
 */
export function themeGallery(): Plugin {
  return {
    name: "webforge:theme-gallery",
    resolveId: (id) => (id === MODULE ? `\0${MODULE}` : undefined),
    load(id) {
      if (id !== `\0${MODULE}`) return undefined;
      const names = THEME_PRESETS.map((preset) => preset.preset);
      const path = (name: string) => join(THEMES_DIR, `${name}.css`).replaceAll("\\", "/");
      return [
        ...names.map(
          (name, at) => `import css${at} from ${JSON.stringify(`${path(name)}?inline`)};`,
        ),
        `export default { ${names.map((name, at) => `${JSON.stringify(name)}: css${at}`).join(", ")} };`,
      ].join("\n");
    },
  };
}
