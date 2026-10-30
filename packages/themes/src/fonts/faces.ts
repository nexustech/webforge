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

/** A font of the theme, by what it is for (3.22 adds the accent). */
type FontRole = keyof ThemeTokens["fonts"];

/**
 * What each font of a theme is set in today: the heading font's type scale weights, and the
 * components' semibold and bold headings; the body font's own weights, bold and italic text. The
 * accent font (3.22) can be any title or text's, so it takes both.
 */
function wanted(theme: ThemeTokens, role: FontRole) {
  const { typeScale } = theme;
  const heading = [
    ...(["h1", "h2", "h3", "h4", "h5", "h6"] as const).map((s) => typeScale[s].weight),
    600,
    700,
  ];
  const body = [typeScale.body.weight, typeScale.small.weight, 400, 700];
  switch (role) {
    case "heading":
      return { weights: heading, styles: ["normal"] as const };
    case "body":
      return { weights: body, styles: ["normal", "italic"] as const };
    case "accent":
      return { weights: [...heading, ...body], styles: ["normal", "italic"] as const };
  }
}

/**
 * Whether a site's classes (`candidates`) set something in the theme's accent font (3.22): the
 * `font-accent` class that an element's Font of Accent gives it, on any device, or that the
 * person's own code uses, `!` before or after, or its variable `--font-accent` there. Without one,
 * the site has no files of the accent font (C8).
 */
export function usesAccentFont(candidates: Iterable<string>): boolean {
  for (const candidate of candidates) {
    if (/(^|:)!?font-accent!?$|--font-accent\b/.test(candidate)) return true;
  }
  return false;
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
 * The font files a site with `theme` uses (2.2): for its heading and body fonts, and its accent
 * font when `accent` (3.22, {@link usesAccentFont}), each subset of the styles and weights
 * {@link wanted} (a variable font's one file covers every weight; a static font's nearest weight
 * stands in for one it doesn't have), each file once. `families` are the fonts there are files
 * for: the catalogue's, and those this computer downloaded. A font that isn't among them has none:
 * the site shows its fallback.
 */
export function fontFacesFor(
  theme: ThemeTokens,
  families: readonly CatalogueFont[] = FONT_CATALOGUE,
  { accent = false }: { readonly accent?: boolean } = {},
): FontFace[] {
  const faces = new Map<string, FontFace>();
  const roles: readonly FontRole[] = accent ? ["heading", "body", "accent"] : ["heading", "body"];
  for (const role of roles) {
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
