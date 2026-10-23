// The rules a font's files are chosen by (2.2, S4, C1, PH2-8), shared by the catalogue build
// (`tools/src/build-font-catalogue.ts`) and the app's on-demand downloads, so a downloaded family
// gets exactly the files a bundled one would.
//
// This file has no relative imports, so Node can run the catalogue build with type stripping.

import { z } from "zod";

/** Fontsource's API, pinned to its version 1. */
export const FONTSOURCE_API = "https://api.fontsource.org/v1";
/** Where a package's files are read from: jsDelivr's copy of the npm package. */
export const PACKAGE_FILES = "https://cdn.jsdelivr.net/npm";
/** jsDelivr's listing of a package's files, with each one's size and SHA-256. */
export const PACKAGE_LISTINGS = "https://data.jsdelivr.com/v1/packages/npm";

/**
 * The licences a font may have (C1): they allow bundling it with any software and with the sites
 * it makes, only not selling it on its own. Every other one is refused.
 */
export const FONT_LICENCES = ["OFL-1.1", "Apache-2.0", "UFL-1.0"] as const;
export type FontLicence = (typeof FONT_LICENCES)[number];

/** The categories the font picker lists (Fontsource's, less `icons` and `other`). */
export const FONT_CATEGORIES = [
  "sans-serif",
  "serif",
  "display",
  "handwriting",
  "monospace",
] as const;
export type FontCategory = (typeof FONT_CATEGORIES)[number];

/** The generic families a font falls back to. */
export type FontFallback = "sans-serif" | "serif" | "monospace";

/** The subsets bundled or downloaded: enough for every language written in Latin script. */
export const FONT_SUBSETS = ["latin", "latin-ext"] as const;
/** The weights taken of a font that isn't variable, when it has them; italics only at two. */
const STATIC_WEIGHTS = [300, 400, 500, 600, 700];
const STATIC_ITALIC_WEIGHTS = [400, 700];

/** A font id, as Fontsource and npm name it: `playfair-display`. */
export const fontIdSchema = z
  .string()
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

/** A subset's characters, as `@font-face`'s `unicode-range` takes them; nothing else fits. */
export const unicodeRangeSchema = z.string().regex(/^U\+[0-9A-Fa-f?-]+(?:,U\+[0-9A-Fa-f?-]+)*$/);

/** A family's metadata from Fontsource's API (`/v1/fonts/<id>`), the parts the files need. */
export const fontMetadataSchema = z.object({
  id: fontIdSchema,
  family: z.string().min(1),
  subsets: z.array(z.string()),
  weights: z.array(z.number().int().min(1).max(1000)).min(1),
  styles: z.array(z.enum(["normal", "italic"])).min(1),
  variable: z.boolean(),
  category: z.string(),
  license: z.string(),
  /** Each subset's characters. */
  unicodeRange: z.record(z.string(), unicodeRangeSchema),
});
export type FontMetadata = z.infer<typeof fontMetadataSchema>;

/** A variable font's axes (`/v1/variable/<id>`): its weight axis is the one used. */
export const fontAxesSchema = z.object({
  axes: z.record(z.string(), z.object({ min: z.coerce.number(), max: z.coerce.number() })),
});

/** One file of a family, before its size and hash are known. */
export type PlannedFile = {
  readonly file: string;
  readonly subset: (typeof FONT_SUBSETS)[number];
  readonly style: "normal" | "italic";
  /** The weight, or the range a variable font covers. */
  readonly weight: number | readonly [number, number];
  /** The subset's characters, for `@font-face`'s `unicode-range`. */
  readonly unicodeRange: string;
};

/** A family with the files to take of it, before their sizes and hashes are known. */
export type PlannedFamily = {
  readonly id: string;
  readonly family: string;
  readonly category: FontCategory;
  readonly fallback: FontFallback;
  readonly licence: FontLicence;
  readonly variable: boolean;
  readonly weights: readonly number[];
  readonly styles: readonly ("normal" | "italic")[];
  readonly package: string;
  readonly version: string;
  readonly files: readonly PlannedFile[];
};

/** A licence a font may have, or undefined for any other. */
export function allowedLicence(licence: string): FontLicence | undefined {
  return FONT_LICENCES.find((allowed) => allowed === licence);
}

/** The category the picker lists a font in, or undefined for one it doesn't list. */
export function fontCategory(category: string): FontCategory | undefined {
  return FONT_CATEGORIES.find((each) => each === category);
}

/** The npm package a font's files come from: the variable one when the font is variable. */
export function fontPackage(id: string, variable: boolean): string {
  return `${variable ? "@fontsource-variable" : "@fontsource"}/${id}`;
}

/** The generic family a font falls back to: its own choice, or its category's. */
function fallbackOf(category: string, chosen: FontFallback | undefined): FontFallback | undefined {
  if (chosen !== undefined) return chosen;
  if (category === "sans-serif" || category === "serif" || category === "monospace") {
    return category;
  }
  return undefined;
}

/**
 * Plans one family from its metadata: its licence, fallback, package and the files to take.
 * `weightAxis` is a variable font's weight range. Throws, naming the family, for a licence that
 * isn't allowed, a font without Latin or its characters' range, a category the picker doesn't
 * list, a display or handwriting font with no fallback chosen, or a variable font without a
 * weight axis.
 */
export function planFamily(
  metadata: FontMetadata,
  choice: { readonly fallback?: FontFallback; readonly category?: FontCategory },
  version: string,
  weightAxis?: readonly [number, number],
): PlannedFamily {
  const licence = allowedLicence(metadata.license);
  if (licence === undefined) {
    throw new Error(`${metadata.family}: licence ${metadata.license} is not allowed`);
  }
  if (!metadata.subsets.includes("latin")) {
    throw new Error(`${metadata.family}: has no Latin subset`);
  }
  const category = choice.category ?? fontCategory(metadata.category);
  if (category === undefined) {
    throw new Error(
      `${metadata.family}: category ${metadata.category} is not one the picker lists`,
    );
  }
  const fallback = fallbackOf(metadata.category, choice.fallback);
  if (fallback === undefined) {
    throw new Error(`${metadata.family}: a ${metadata.category} font needs a fallback`);
  }
  if (metadata.variable && weightAxis === undefined) {
    throw new Error(`${metadata.family}: a variable font without a weight axis`);
  }
  const subsets = FONT_SUBSETS.filter((subset) => metadata.subsets.includes(subset));
  const files: PlannedFile[] = [];
  for (const subset of subsets) {
    const unicodeRange = metadata.unicodeRange[subset];
    if (unicodeRange === undefined) {
      throw new Error(`${metadata.family}: no character range for its ${subset} subset`);
    }
    for (const style of metadata.styles) {
      if (weightAxis !== undefined) {
        files.push({
          file: `${metadata.id}-${subset}-wght-${style}.woff2`,
          subset,
          style,
          weight: weightAxis,
          unicodeRange,
        });
        continue;
      }
      const wanted = style === "italic" ? STATIC_ITALIC_WEIGHTS : STATIC_WEIGHTS;
      const weights = metadata.weights.filter((weight) => wanted.includes(weight));
      // A font with one weight outside the usual ones (a display font's 400 is in) keeps it.
      for (const weight of weights.length > 0 ? weights : metadata.weights.slice(0, 1)) {
        files.push({
          file: `${metadata.id}-${subset}-${weight}-${style}.woff2`,
          subset,
          style,
          weight,
          unicodeRange,
        });
      }
    }
  }
  return {
    id: metadata.id,
    family: metadata.family,
    category,
    fallback,
    licence,
    variable: metadata.variable,
    weights: metadata.weights,
    styles: metadata.styles,
    package: fontPackage(metadata.id, metadata.variable),
    version,
    files,
  };
}
