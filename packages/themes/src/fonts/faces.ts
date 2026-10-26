import type { ThemeTokens } from "@webforge/model";
import { type CatalogueFont, FONT_CATALOGUE } from "./catalogue.js";

/**
 * One font file a site uses, as its stylesheet declares it (`@font-face`) and its export copies it
 * (2.2): the family, the file in its npm package, and the size and hash it must have.
 */
export type FontFace = {
  readonly family: string;
  /** The npm package the file is in (`@fontsource-variable/inter`). */
  readonly package: string;
  /** The file's name in the package's `files/` folder, and in an exported site's `assets/fonts/`. */
  readonly file: string;
  readonly style: "normal" | "italic";
  /** The weight, or the range a variable font covers. */
  readonly weight: number | readonly [number, number];
  readonly unicodeRange: string;
  readonly bytes: number;
  readonly sha256: string;
};

/**
 * What each font of a theme is set in today: the heading font's type scale weights, and the
 * components' semibold and bold headings; the body font's own weights, bold and italic text.
 */
function wanted(theme: ThemeTokens, role: "heading" | "body") {
  const { typeScale } = theme;
  return role === "heading"
    ? {
        weights: [
          ...(["h1", "h2", "h3", "h4", "h5", "h6"] as const).map((s) => typeScale[s].weight),
          600,
          700,
        ],
        styles: ["normal"] as const,
      }
    : {
        weights: [typeScale.body.weight, typeScale.small.weight, 400, 700],
        styles: ["normal", "italic"] as const,
      };
}

/** The bundled weight of `font` in `style` nearest `weight`, the heavier of two as near. */
function nearest(font: CatalogueFont, style: "normal" | "italic", weight: number) {
  const weights = font.files.flatMap((file) =>
    file.style === style && typeof file.weight === "number" ? [file.weight] : [],
  );
  return weights.reduce<number | undefined>((best, each) => {
    if (best === undefined) return each;
    const [distance, bestDistance] = [Math.abs(each - weight), Math.abs(best - weight)];
    return distance < bestDistance || (distance === bestDistance && each > best) ? each : best;
  }, undefined);
}

/**
 * The font files a site with `theme` uses (2.2): for its heading and body fonts, each subset of
 * the styles and weights {@link wanted} (a variable font's one file covers every weight; a static
 * font's nearest weight stands in for one it doesn't have), each file once. `families` are the
 * fonts there are files for: the catalogue's, and those this computer downloaded. A font that
 * isn't among them has none: the site shows its fallback.
 */
export function fontFacesFor(
  theme: ThemeTokens,
  families: readonly CatalogueFont[] = FONT_CATALOGUE,
): FontFace[] {
  const faces = new Map<string, FontFace>();
  for (const role of ["heading", "body"] as const) {
    const font = families.find((each) => each.family === theme.fonts[role].family);
    if (font === undefined) continue;
    const { weights, styles } = wanted(theme, role);
    for (const style of styles) {
      const chosen = new Set(weights.map((weight) => nearest(font, style, weight)));
      for (const file of font.files) {
        const used =
          file.style === style &&
          (typeof file.weight === "number" ? chosen.has(file.weight) : true);
        if (used) faces.set(file.file, { family: font.family, package: font.package, ...file });
      }
    }
  }
  return [...faces.values()];
}

/** Whether a file has regular text: weight 400, or a range that covers it. */
const regular = (weight: CatalogueFont["files"][number]["weight"]) =>
  typeof weight === "number" ? weight === 400 : weight[0] <= 400 && 400 <= weight[1];

/**
 * The one file `font` is previewed with in the font picker (2.3a, 2.3c): its Latin regular, else
 * the nearest upright one it has; undefined for a font without files.
 */
export function previewFileOf(
  font: Pick<CatalogueFont, "files">,
): CatalogueFont["files"][number] | undefined {
  const upright = font.files.filter((file) => file.style === "normal");
  return (
    upright.find((file) => file.subset === "latin" && regular(file.weight)) ??
    upright.find((file) => file.subset === "latin") ??
    upright[0] ??
    font.files[0]
  );
}
