import { components } from "./en/components/index.js";
import { en } from "./en.js";
import {
  lookups,
  type ParamsArgIn,
  type ParamsIn,
  type PluralKeyIn,
  type PluralParamsIn,
} from "./translate.js";

/**
 * The whole English catalogue: the app's own words and the site components' (their fields,
 * starter content and the site's labels). The editor and the export worker read it; main reads
 * only the app's own (`@webforge/i18n`), so its start-up doesn't load these (#1150).
 */
const catalogue = { ...en, ...components };

/** A key of the whole English catalogue, the site components' words included. */
export type ComponentMessageKey = keyof typeof catalogue;

/** {@link ParamsIn} for the whole catalogue. */
export type ComponentParamsOf<K extends ComponentMessageKey> = ParamsIn<typeof catalogue, K>;

/** {@link ParamsArgIn} for the whole catalogue. */
export type ComponentParamsArg<K extends ComponentMessageKey> = ParamsArgIn<typeof catalogue, K>;

/** {@link PluralKeyIn} for the whole catalogue. */
export type ComponentPluralKey = PluralKeyIn<typeof catalogue>;

const all = lookups(catalogue);

/**
 * `@webforge/i18n`'s `t`, for any key of the whole catalogue, the site components' included.
 *
 * @example t("field.heading") // "Heading"
 */
export function t<K extends ComponentMessageKey>(
  key: K,
  ...[params]: ComponentParamsArg<K>
): string {
  return all.t(key, params);
}

/** `@webforge/i18n`'s `template`, for any key of the whole catalogue. */
export function template(key: ComponentMessageKey): string {
  return all.template(key);
}

/** Whether `key` is in the whole catalogue, the site components' words included. */
export function isComponentMessageKey(key: string): key is ComponentMessageKey {
  return all.has(key);
}

/** `@webforge/i18n`'s `plural`, for any key of the whole catalogue. */
export function plural<B extends ComponentPluralKey>(
  base: B,
  count: number,
  ...[params]: PluralParamsIn<typeof catalogue, B>
): string {
  return all.plural(base, count, params);
}

/** The whole catalogue, for the site's English labels (`./site-text.js`). */
export const english: Readonly<Record<ComponentMessageKey, string>> = catalogue;
