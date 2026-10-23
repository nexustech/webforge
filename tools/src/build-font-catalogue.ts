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
// from the package's own copy on jsDelivr, so later builds can check what they bundle. Which files
// a family gets follows `@webforge/themes/font-plan`, as the app's downloads do.
//
// This file has no relative imports so Node can run it directly with type stripping.

import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import {
  FONTSOURCE_API,
  type FontCategory,
  type FontFallback,
  fontAxesSchema,
  fontMetadataSchema,
  fontPackage,
  PACKAGE_FILES,
  planFamily,
} from "@webforge/themes/font-plan";
import { z } from "zod";

const NPM_REGISTRY = "https://registry.npmjs.org";

/** What the bundled fonts may add to the installer (2.2: a budget of about 10–15 MB). */
export const FONT_BUDGET_BYTES = 15 * 1024 * 1024;

/**
 * The bundled families (S4, F-DS-2: about 50): the popular, readable choices for a small
 * business's site, across sans, serif, display, handwriting and monospace. The fallback, for
 * display and handwriting fonts, is the generic family closest in look. `category` puts a font
 * the picker should list elsewhere than Fontsource does: its display fonts for headings, which
 * Fontsource files as sans-serif.
 */
export const FAMILIES: readonly {
  readonly id: string;
  readonly fallback?: FontFallback;
  readonly category?: FontCategory;
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
    ? fontAxesSchema.parse(await fetchJson(get, `${FONTSOURCE_API}/variable/${choice.id}`)).axes
        .wght
    : undefined;
  const name = fontPackage(metadata.id, metadata.variable);
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

/** Where the catalogue goes: the themes package, which loads and checks it. */
export const CATALOGUE_FILE = new URL(
  "../../packages/themes/src/fonts/catalogue.json",
  import.meta.url,
);

/**
 * Builds the catalogue (see {@link buildCatalogue}) and writes it with `write`, or reports its
 * problems and writes nothing. Returns whether it wrote it.
 */
export async function writeCatalogue(
  get: Fetch,
  write: (target: URL, text: string) => void,
  families: typeof FAMILIES = FAMILIES,
  pairings: typeof PAIRINGS = PAIRINGS,
): Promise<boolean> {
  const { catalogue, bytes, problems } = await buildCatalogue(get, families, pairings);
  if (problems.length > 0) {
    console.error(problems.join("\n"));
    return false;
  }
  write(CATALOGUE_FILE, `${JSON.stringify(catalogue, null, 2)}\n`);
  console.log(
    `Wrote ${catalogue.families.length} families, ${(bytes / 1024 / 1024).toFixed(1)} MB of fonts.`,
  );
  return true;
}

if (import.meta.main && !(await writeCatalogue(fetch, writeFileSync))) {
  process.exitCode = 1;
}
