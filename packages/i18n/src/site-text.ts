// The site's own labels in its language (6.12, CC-1): `@webforge/i18n/site-text`, an entry of its
// own, so the app's start-up, which needs `t` alone, doesn't load the other languages' catalogues.
import { de } from "./de/site-text.js";
import { en } from "./en.js";
import { es } from "./es/site-text.js";
import { fr } from "./fr/site-text.js";
import type { SiteText, SiteTextCatalogue, SiteTextKey } from "./site-text-key.js";

import { filled, type MessageParams, type ParamsArg } from "./translate.js";

export type { SiteText, SiteTextCatalogue, SiteTextKey } from "./site-text-key.js";

/** Every label of the exported site, in the English catalogue's order (6.12). */
export const SITE_TEXT_KEYS: readonly SiteTextKey[] = Object.keys(en).filter(
  (key): key is SiteTextKey => key.startsWith("siteText."),
);

/** The catalogues of the languages a site's labels come in besides English, by language code. */
const CATALOGUES: Readonly<Record<string, SiteTextCatalogue>> = { fr, de, es };

/**
 * The catalogue for `language`, a BCP 47 tag: its primary language's (`de-AT` → `de`), or none
 * for English, a language without one, or no language at all.
 */
function siteTextCatalogue(language: string | undefined): SiteTextCatalogue {
  const primary = language?.split("-")[0]?.toLowerCase() ?? "";
  return Object.hasOwn(CATALOGUES, primary) ? (CATALOGUES[primary] ?? {}) : {};
}

/**
 * `catalogue`'s labels, each one it lacks in English (6.12): a language's catalogue can be
 * incomplete, and its site still says everything.
 */
export function siteTextFrom(catalogue: SiteTextCatalogue): SiteText {
  return (key, ...[params]) =>
    filled(catalogue[key] ?? en[key], params as MessageParams | undefined);
}

/**
 * The labels of a site whose language is `language` (6.12, CC-1): the owner's own wording for any
 * they changed (`overrides`, by key: Site Settings' *Labels on your site*), else its language's
 * catalogue, and English for a label it lacks or a language without one. What the canvas and the
 * export give site components as `context.siteText`.
 */
export function siteTextFor(
  language: string | undefined,
  overrides: Readonly<Record<string, string>> = {},
): SiteText {
  const catalogue = siteTextCatalogue(language);
  const own = Object.entries(overrides).filter(([, text]) => text.trim() !== "");
  return siteTextFrom(own.length === 0 ? catalogue : { ...catalogue, ...Object.fromEntries(own) });
}

/**
 * One label of a site whose language is `language`, with its `{placeholder}`s filled in.
 *
 * @example siteText("de-AT", "siteText.menu") // "Menü"
 */
export function siteText<K extends SiteTextKey>(
  language: string | undefined,
  key: K,
  ...params: ParamsArg<K>
): string {
  return siteTextFor(language)(key, ...params);
}
