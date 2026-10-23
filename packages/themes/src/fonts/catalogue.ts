import { type FontRef, fontRefSchema } from "@webforge/model";
import { z } from "zod";
import catalogueJson from "./catalogue.json" with { type: "json" };

/**
 * The licences a font may have (C1): they allow bundling it with the app and the sites it makes.
 * `tools/src/build-font-catalogue.ts` refuses every other one, and so does this schema.
 */
export const FONT_LICENCES = ["OFL-1.1", "Apache-2.0", "UFL-1.0"] as const;

/** What the bundled fonts may add to the installer (2.2: a budget of about 10–15 MB). */
export const FONT_BUDGET_BYTES = 15 * 1024 * 1024;

const fileSchema = z.strictObject({
  /** The file's name in its package's `files/` folder, and in an exported site's `assets/fonts/`. */
  file: z.string().regex(/^[a-z0-9-]+\.woff2$/),
  subset: z.enum(["latin", "latin-ext"]),
  style: z.enum(["normal", "italic"]),
  /** The weight, or the range a variable font covers. */
  weight: z.union([z.number().int(), z.tuple([z.number().int(), z.number().int()])]),
  bytes: z.number().int().positive(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});

const familySchema = z.strictObject({
  /** Fontsource's id: `playfair-display`. */
  id: z.string().regex(/^[a-z0-9-]+$/),
  /** The CSS family name, as a theme's fonts store it. */
  family: fontRefSchema.shape.family,
  /** Fontsource's category: sans-serif, serif, display, handwriting or monospace. */
  category: z.string(),
  fallback: fontRefSchema.shape.fallback,
  licence: z.enum(FONT_LICENCES),
  variable: z.boolean(),
  weights: z.array(z.number().int()).min(1),
  styles: z.array(z.enum(["normal", "italic"])).min(1),
  /** The npm package the files come from, and its version. */
  package: z.string().regex(/^@fontsource(?:-variable)?\/[a-z0-9-]+$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  files: z.array(fileSchema).min(1),
});

const catalogueSchema = z
  .strictObject({
    source: z.strictObject({ api: z.url(), files: z.url() }),
    families: z.array(familySchema).min(1),
    pairings: z.array(
      z.strictObject({ id: z.string().regex(/^[a-z-]+$/), heading: z.string(), body: z.string() }),
    ),
  })
  .refine(
    ({ families, pairings }) => {
      const ids = new Set(families.map((family) => family.id));
      return pairings.every((pairing) => ids.has(pairing.heading) && ids.has(pairing.body));
    },
    { message: "A pairing names a family the catalogue doesn't have" },
  );

/** A family the installer bundles (2.2): its name, licence, package and files. */
export type CatalogueFont = z.infer<typeof familySchema>;

/** A tested pairing of a heading font and a body font, by family id. Its name is `t(fonts.pairing.<id>)`. */
export type FontPairing = z.infer<typeof catalogueSchema>["pairings"][number];

const catalogue = catalogueSchema.parse(catalogueJson);

/** The bundled families (S4, F-DS-2), as `tools/src/build-font-catalogue.ts` wrote them. */
export const FONT_CATALOGUE: readonly CatalogueFont[] = catalogue.families;

/** The tested pairings (F-DS-2). */
export const FONT_PAIRINGS: readonly FontPairing[] = catalogue.pairings;

/** The bundled family with Fontsource id `id`, if there is one. */
export function catalogueFont(id: string): CatalogueFont | undefined {
  return FONT_CATALOGUE.find((font) => font.id === id);
}

/** `font` as a theme stores it. */
export function fontRefOf(font: CatalogueFont): FontRef {
  return { family: font.family, fallback: font.fallback };
}

/** The bytes the families' files take: what they add to the installer. */
export function bundledFontBytes(fonts: readonly CatalogueFont[]): number {
  return fonts.flatMap((font) => font.files).reduce((sum, file) => sum + file.bytes, 0);
}
