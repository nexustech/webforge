// Font catalogue build (2.2, S4, C1, PH2-8): writes `packages/themes/src/fonts/catalogue.json`, the
// fonts the installer bundles and the pairings offered with them.
//
// Usage (needs the network; run it when the selection below changes, then commit the result):
//   pnpm font-catalogue
//
// For each family it reads Fontsource's metadata from its pinned API (v1), refuses any licence but
// OFL-1.1, Apache-2.0 and UFL-1.0, and lists the files to bundle: the Latin and Latin Extended
// subsets of the family's npm package (`@fontsource-variable/<id>` when the font is variable,
// else `@fontsource/<id>`), at the version the registry has now. Each file's size and SHA-256 come
// from the package's own copy on jsDelivr, so later builds can check what they bundle or download.
//
// This file has no relative imports so Node can run it directly with type stripping.

import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { z } from "zod";

/** Fontsource's API, pinned to its version 1. */
export const FONTSOURCE_API = "https://api.fontsource.org/v1";
/** Where a package's files are read from: jsDelivr's copy of the npm package. */
export const PACKAGE_FILES = "https://cdn.jsdelivr.net/npm";
const NPM_REGISTRY = "https://registry.npmjs.org";

/**
 * The licences a catalogued font may have (C1): they allow bundling the fonts with any software
 * and with the sites it makes, only not selling them on their own.
 */
export const FONT_LICENCES = ["OFL-1.1", "Apache-2.0", "UFL-1.0"] as const;

/** The subsets the installer bundles: enough for every language written in Latin script. */
export const BUNDLED_SUBSETS = ["latin", "latin-ext"] as const;
/** The weights bundled of a font that isn't variable, when it has them; italics only at two. */
const STATIC_WEIGHTS = [300, 400, 500, 600, 700];
const STATIC_ITALIC_WEIGHTS = [400, 700];

/** What the bundled fonts may add to the installer (2.2: a budget of about 10–15 MB). */
export const FONT_BUDGET_BYTES = 15 * 1024 * 1024;

type Fallback = "sans-serif" | "serif" | "monospace";

/** The categories the font picker lists (Fontsource's, less `icons` and `other`). */
export const FONT_CATEGORIES = [
  "sans-serif",
  "serif",
  "display",
  "handwriting",
  "monospace",
] as const;
type Category = (typeof FONT_CATEGORIES)[number];

/**
 * The bundled families (S4, F-DS-2: about 50): the popular, readable choices for a small
 * business's site, across sans, serif, display, handwriting and monospace. The fallback, for
 * display and handwriting fonts, is the generic family closest in look. `category` puts a font
 * the picker should list elsewhere than Fontsource does: its display fonts for headings, which
 * Fontsource files as sans-serif.
 */
export const FAMILIES: readonly {
  readonly id: string;
  readonly fallback?: Fallback;
  readonly category?: Category;
}[] = [
  // Sans-serif.
  { id: "inter" },
  { id: "roboto" },
  { id: "open-sans" },
  { id: "lato" },
  { id: "montserrat" },
  { id: "poppins" },
  { id: "nunito" },
  { id: "raleway" },
  { id: "work-sans" },
  { id: "dm-sans" },
  { id: "manrope" },
  { id: "outfit" },
  { id: "plus-jakarta-sans" },
  { id: "figtree" },
  { id: "source-sans-3" },
  { id: "rubik" },
  { id: "josefin-sans" },
  { id: "lexend" },
  { id: "space-grotesk" },
  { id: "quicksand" },
  // Serif.
  { id: "playfair-display" },
  { id: "merriweather" },
  { id: "lora" },
  { id: "eb-garamond" },
  { id: "cormorant-garamond" },
  { id: "libre-baskerville" },
  { id: "source-serif-4" },
  { id: "crimson-pro" },
  { id: "dm-serif-display" },
  { id: "fraunces" },
  { id: "roboto-slab" },
  { id: "bitter" },
  { id: "pt-serif" },
  { id: "spectral" },
  // Display: for headings.
  { id: "bebas-neue", category: "display", fallback: "sans-serif" },
  { id: "oswald", category: "display", fallback: "sans-serif" },
  { id: "abril-fatface", fallback: "serif" },
  { id: "righteous", fallback: "sans-serif" },
  { id: "alfa-slab-one", fallback: "serif" },
  { id: "anton", category: "display", fallback: "sans-serif" },
  { id: "syne", category: "display", fallback: "sans-serif" },
  { id: "unbounded", category: "display", fallback: "sans-serif" },
  // Handwriting: for headings and short lines.
  { id: "dancing-script", fallback: "serif" },
  { id: "pacifico", fallback: "sans-serif" },
  { id: "caveat", fallback: "sans-serif" },
  { id: "great-vibes", fallback: "serif" },
  { id: "sacramento", fallback: "serif" },
  // Monospace.
  { id: "jetbrains-mono" },
  { id: "ibm-plex-mono" },
  { id: "space-mono" },
];

/** The tested pairings (F-DS-2: 12–15), a heading font and a body font each. */
export const PAIRINGS: readonly {
  readonly id: string;
  readonly heading: string;
  readonly body: string;
}[] = [
  { id: "simple", heading: "inter", body: "inter" },
  { id: "classic", heading: "playfair-display", body: "source-sans-3" },
  { id: "modern", heading: "montserrat", body: "open-sans" },
  { id: "friendly", heading: "quicksand", body: "nunito" },
  { id: "elegant", heading: "cormorant-garamond", body: "raleway" },
  { id: "editorial", heading: "fraunces", body: "inter" },
  { id: "bold", heading: "bebas-neue", body: "roboto" },
  { id: "warm", heading: "lora", body: "work-sans" },
  { id: "crisp", heading: "plus-jakarta-sans", body: "dm-sans" },
  { id: "bookish", heading: "eb-garamond", body: "crimson-pro" },
  { id: "technical", heading: "space-grotesk", body: "figtree" },
  { id: "playful", heading: "pacifico", body: "poppins" },
  { id: "handmade", heading: "caveat", body: "rubik" },
  { id: "strong", heading: "oswald", body: "merriweather" },
  { id: "luxury", heading: "dm-serif-display", body: "manrope" },
];

/** A family's metadata from Fontsource's API (`/v1/fonts/<id>`), the parts the catalogue uses. */
export const fontMetadataSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  family: z.string().min(1),
  subsets: z.array(z.string()),
  weights: z.array(z.number().int().min(1).max(1000)).min(1),
  styles: z.array(z.enum(["normal", "italic"])).min(1),
  variable: z.boolean(),
  category: z.string(),
  license: z.string(),
  /** Each subset's characters, as `@font-face`'s `unicode-range` takes them. */
  unicodeRange: z.record(
    z.string(),
    z.string().regex(/^U\+[0-9A-Fa-f?-]+(?:,U\+[0-9A-Fa-f?-]+)*$/),
  ),
});
export type FontMetadata = z.infer<typeof fontMetadataSchema>;

/** A variable font's axes (`/v1/variable/<id>`): the catalogue needs its weight axis. */
const axesSchema = z.object({
  axes: z.record(z.string(), z.object({ min: z.coerce.number(), max: z.coerce.number() })),
});

/** One file of a family to bundle, before its size and hash are known. */
export type PlannedFile = {
  readonly file: string;
  readonly subset: (typeof BUNDLED_SUBSETS)[number];
  readonly style: "normal" | "italic";
  /** The weight, or the range a variable font covers. */
  readonly weight: number | readonly [number, number];
  /** The subset's characters, for `@font-face`'s `unicode-range`. */
  readonly unicodeRange: string;
};

/** A family as the catalogue lists it, before its files' sizes and hashes are known. */
export type PlannedFamily = {
  readonly id: string;
  readonly family: string;
  readonly category: Category;
  readonly fallback: Fallback;
  readonly licence: (typeof FONT_LICENCES)[number];
  readonly variable: boolean;
  readonly weights: readonly number[];
  readonly styles: readonly ("normal" | "italic")[];
  readonly package: string;
  readonly version: string;
  readonly files: readonly PlannedFile[];
};

/** A licence the catalogue may have, or undefined for any other. */
export function allowedLicence(licence: string): (typeof FONT_LICENCES)[number] | undefined {
  return FONT_LICENCES.find((allowed) => allowed === licence);
}

/** The generic family a font falls back to: its own choice, or its category's. */
function fallbackOf(category: string, chosen: Fallback | undefined): Fallback | undefined {
  if (chosen !== undefined) return chosen;
  if (category === "sans-serif" || category === "serif" || category === "monospace") {
    return category;
  }
  return undefined;
}

/**
 * Plans one family of the catalogue from its metadata: its licence, fallback, package and the
 * files to bundle. `weightAxis` is a variable font's weight range. Throws, naming the family, for
 * a licence the catalogue doesn't allow, a font without Latin or its characters' range, a category
 * the picker doesn't list, a display or handwriting font with no fallback chosen, or a variable
 * font without a weight axis.
 */
export function planFamily(
  metadata: FontMetadata,
  choice: { readonly fallback?: Fallback; readonly category?: Category },
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
  const category = choice.category ?? FONT_CATEGORIES.find((each) => each === metadata.category);
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
  const subsets = BUNDLED_SUBSETS.filter((subset) => metadata.subsets.includes(subset));
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
    package: `${metadata.variable ? "@fontsource-variable" : "@fontsource"}/${metadata.id}`,
    version,
    files,
  };
}

/** The pairings' problems: a family the catalogue doesn't have, or an id used twice. */
export function pairingProblems(
  pairings: typeof PAIRINGS,
  families: readonly { readonly id: string }[],
): string[] {
  const known = new Set(families.map((family) => family.id));
  const problems = pairings.flatMap((pairing) =>
    [pairing.heading, pairing.body]
      .filter((id) => !known.has(id))
      .map((id) => `Pairing ${pairing.id}: no family ${id} in the catalogue`),
  );
  const ids = pairings.map((pairing) => pairing.id);
  for (const [index, id] of ids.entries()) {
    if (ids.indexOf(id) !== index) problems.push(`Pairing ${id}: listed twice`);
  }
  return problems;
}

/** Fetches a URL: `fetch` itself, or a fake in tests. */
export type Fetch = (url: string) => Promise<Response>;

async function fetchJson(get: Fetch, url: string): Promise<unknown> {
  const response = await get(url);
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
  return response.json();
}

async function fetchBytes(get: Fetch, url: string): Promise<Uint8Array> {
  const response = await get(url);
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
  return new Uint8Array(await response.arrayBuffer());
}

/** One family read from Fontsource and the registry, with its files measured and hashed. */
async function buildFamily(get: Fetch, choice: (typeof FAMILIES)[number]) {
  const metadata = fontMetadataSchema.parse(
    await fetchJson(get, `${FONTSOURCE_API}/fonts/${choice.id}`),
  );
  const weightAxis = metadata.variable
    ? axesSchema.parse(await fetchJson(get, `${FONTSOURCE_API}/variable/${choice.id}`)).axes.wght
    : undefined;
  const name = `${metadata.variable ? "@fontsource-variable" : "@fontsource"}/${metadata.id}`;
  const { version } = z
    .object({ version: z.string() })
    .parse(await fetchJson(get, `${NPM_REGISTRY}/${name}/latest`));
  const planned = planFamily(
    metadata,
    choice,
    version,
    weightAxis === undefined ? undefined : [weightAxis.min, weightAxis.max],
  );
  const files = await Promise.all(
    planned.files.map(async (file) => {
      const data = await fetchBytes(get, `${PACKAGE_FILES}/${name}@${version}/files/${file.file}`);
      const sha256 = createHash("sha256").update(data).digest("hex");
      return { ...file, bytes: data.byteLength, sha256 };
    }),
  );
  return { ...planned, files };
}

/**
 * Builds the catalogue of `families` and `pairings`, reading through `get`: the catalogue, the
 * bytes its files take, and what is wrong with it (a pairing's unknown family, the budget
 * exceeded). Throws for a family {@link planFamily} refuses, or a request that fails.
 */
export async function buildCatalogue(
  get: Fetch,
  families: typeof FAMILIES = FAMILIES,
  pairings: typeof PAIRINGS = PAIRINGS,
  budget = FONT_BUDGET_BYTES,
) {
  const built = [];
  for (const choice of families) {
    built.push(await buildFamily(get, choice));
  }
  const problems = pairingProblems(pairings, built);
  const bytes = built.flatMap((family) => family.files).reduce((sum, file) => sum + file.bytes, 0);
  if (bytes > budget) {
    problems.push(`The bundled fonts take ${bytes} bytes, over the budget of ${budget}`);
  }
  const catalogue = {
    source: { api: FONTSOURCE_API, files: PACKAGE_FILES },
    families: built,
    pairings,
  };
  return { catalogue, bytes, problems };
}

async function main(): Promise<void> {
  const { catalogue, bytes, problems } = await buildCatalogue(fetch);
  if (problems.length > 0) {
    console.error(problems.join("\n"));
    process.exitCode = 1;
    return;
  }
  const target = new URL("../../packages/themes/src/fonts/catalogue.json", import.meta.url);
  writeFileSync(target, `${JSON.stringify(catalogue, null, 2)}\n`);
  console.log(
    `Wrote ${catalogue.families.length} families, ${(bytes / 1024 / 1024).toFixed(1)} MB of fonts.`,
  );
}

if (import.meta.main) {
  await main();
}
