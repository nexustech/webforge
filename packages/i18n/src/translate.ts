import { en } from "./en.js";
import { lookups } from "./lookup.js";

export { filled, lookups } from "./lookup.js";

/**
 * A key of the English message catalogue: the app's own words. The site components' words are in
 * `@webforge/i18n/components`, which main never loads (#1150).
 */
export type MessageKey = keyof typeof en;

/** Values substituted into `{placeholder}`s of a message. */
export type MessageParams = Readonly<Record<string, string | number>>;

/** A catalogue of messages by key. */
type Catalogue = Readonly<Record<string, string>>;

/** The `{placeholder}` names in message text `S`: `"{n} of {total}"` gives `"n" | "total"`. */
type Placeholders<S extends string> = S extends `${string}{${infer Name}}${infer Rest}`
  ? Name | Placeholders<Rest>
  : never;

/**
 * The placeholders of message `K` of catalogue `C` (of every message, for a union of keys) that
 * its caller fills: `{appName}`, the app's name, is filled in by {@link t} itself.
 */
export type ParamsIn<C extends Catalogue, K extends keyof C> = Exclude<
  Placeholders<C[K] & string>,
  "appName"
>;

/**
 * What `t(key, …)` takes after the key (B10, E11), for a key of catalogue `C`: the message's
 * placeholders, every one of them, as params; nothing for a message without any. A key typed only
 * as any key of `C` (chosen at run time from the whole catalogue) can't be checked, so it takes any
 * params.
 */
export type ParamsArgIn<C extends Catalogue, K extends keyof C> = keyof C extends K
  ? [params?: MessageParams]
  : [ParamsIn<C, K>] extends [never]
    ? []
    : [params: Readonly<Record<ParamsIn<C, K>, string | number>>];

/** Keys of catalogue `C` with a message per plural category: `base.one` and `base.other`. */
export type PluralKeyIn<C extends Catalogue> = {
  [K in keyof C & string]: K extends `${infer Base}.other`
    ? `${Base}.one` extends keyof C
      ? Base
      : never
    : never;
}[keyof C & string];

/** What `plural(base, count, …)` takes after the count: the params besides `{count}`. */
export type PluralParamsIn<C extends Catalogue, B extends string> = `${B}.other` extends keyof C
  ? [ParamsIn<C, `${B}.other`>] extends ["count" | never]
    ? [params?: MessageParams]
    : [params: Readonly<Record<Exclude<ParamsIn<C, `${B}.other`>, "count">, string | number>>]
  : never;

/** {@link ParamsIn} for the app's own catalogue. */
export type ParamsOf<K extends MessageKey> = ParamsIn<typeof en, K>;

/** {@link ParamsArgIn} for the app's own catalogue. */
export type ParamsArg<K extends MessageKey> = ParamsArgIn<typeof en, K>;

/** {@link PluralKeyIn} for the app's own catalogue. */
export type PluralKey = PluralKeyIn<typeof en>;

const app = lookups(en);

/**
 * Returns the UI string for `key`, with `{placeholder}`s replaced by `params`. The params are
 * checked against the message's placeholders as the code compiles (B10): a missing one is a type
 * error. At run time a placeholder without a matching param is left as is, so a missing value is
 * visible in the UI instead of silently disappearing.
 *
 * @example t("app.version", { version: "1.2.0" }) // "Version 1.2.0"
 */
export function t<K extends MessageKey>(key: K, ...[params]: ParamsArg<K>): string {
  return app.t(key, params);
}

/**
 * The message for `key` with its `{placeholder}`s left in, for code that fills them in itself: a
 * site's script (the Carousel's "{n} of {total}"), or Puck's own dictionary. The app's name is
 * filled in, as {@link t} fills it.
 */
export function template(key: MessageKey): string {
  return app.template(key);
}

/**
 * Whether `key` is in the catalogue: for a key built from data, such as a theme preset's name
 * (`theme.preset.<name>`), which the compiler can't check.
 */
export function isMessageKey(key: string): key is MessageKey {
  return app.has(key);
}

/**
 * The message for `count` of something (B10): `base.one` for 1, `base.other` otherwise, as the
 * language's plural rules choose, falling back to `base.other` for a category the catalogue doesn't
 * have. `{count}` is filled in, with any other params of the messages.
 *
 * @example plural("ui.picker.match", 3) // "3 matches"
 */
export function plural<B extends PluralKey>(
  base: B,
  count: number,
  ...[params]: PluralParamsIn<typeof en, B>
): string {
  return app.plural(base, count, params);
}
