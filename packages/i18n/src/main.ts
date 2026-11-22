import { main } from "./en/main.js";
import { lookups } from "./lookup.js";
import type { MessageParams, ParamsArgIn, PluralKeyIn, PluralParamsIn } from "./translate.js";

/**
 * Main's strings (#1317): `@webforge/i18n`'s lookups over main's own catalogue, the messages main
 * shows and nothing else, so its start-up never loads the editor's (`main-start.spec.ts`). A key
 * main doesn't hold fails to compile; `pnpm main-strings` adds the keys main's files name.
 */

/** Main's catalogue, the English messages it shows: what `pnpm main-strings` checks. */
export { main as english } from "./en/main.js";

/** A key of main's catalogue. */
export type MainMessageKey = keyof typeof main;

const app = lookups(main);

/** `@webforge/i18n`'s `t`, for a key of main's catalogue. */
export function t<K extends MainMessageKey>(
  key: K,
  ...[params]: ParamsArgIn<typeof main, K>
): string {
  return app.t(key, params as MessageParams | undefined);
}

/** `@webforge/i18n`'s `template`, for a key of main's catalogue. */
export function template(key: MainMessageKey): string {
  return app.template(key);
}

/** Whether `key` is in main's catalogue: for a key built at run time. */
export function isMessageKey(key: string): key is MainMessageKey {
  return app.has(key);
}

/** `@webforge/i18n`'s `plural`, for a key of main's catalogue. */
export function plural<B extends PluralKeyIn<typeof main>>(
  base: B,
  count: number,
  ...[params]: PluralParamsIn<typeof main, B>
): string {
  return app.plural(base, count, params);
}
