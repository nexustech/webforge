import { en } from "./en.js";

/** A key of the English message catalogue. */
export type MessageKey = keyof typeof en;

/** Values substituted into `{placeholder}`s of a message. */
export type MessageParams = Readonly<Record<string, string | number>>;

/** The `{placeholder}` names in message text `S`: `"{n} of {total}"` gives `"n" | "total"`. */
type Placeholders<S extends string> = S extends `${string}{${infer Name}}${infer Rest}`
  ? Name | Placeholders<Rest>
  : never;

/** The placeholders of message `K` (of every message, for a union of keys). */
export type ParamsOf<K extends MessageKey> = Placeholders<(typeof en)[K]>;

/**
 * What `t(key, …)` takes after the key (B10, E11): the message's placeholders, every one of them,
 * as params; nothing for a message without any. A key typed only as `MessageKey` (chosen at run
 * time from the whole catalogue) can't be checked, so it takes any params.
 */
type ParamsArg<K extends MessageKey> = MessageKey extends K
  ? [params?: MessageParams]
  : [ParamsOf<K>] extends [never]
    ? []
    : [params: Readonly<Record<ParamsOf<K>, string | number>>];

const PLACEHOLDER = /\{(\w+)\}/g;

/**
 * Returns the UI string for `key`, with `{placeholder}`s replaced by `params`. The params are
 * checked against the message's placeholders as the code compiles (B10): a missing one is a type
 * error. At run time a placeholder without a matching param is left as is, so a missing value is
 * visible in the UI instead of silently disappearing.
 *
 * @example t("app.version", { version: "1.2.0" }) // "Version 1.2.0"
 */
export function t<K extends MessageKey>(key: K, ...[params]: ParamsArg<K>): string {
  const message: string = en[key];
  if (params === undefined) {
    return message;
  }
  return message.replace(PLACEHOLDER, (match, name: string) => {
    const value = (params as MessageParams)[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * The message for `key` with its `{placeholder}`s left in, for code that fills them in itself: a
 * site's script (the Carousel's "{n} of {total}"), or Puck's own dictionary.
 */
export function template(key: MessageKey): string {
  return en[key];
}

/**
 * Whether `key` is in the catalogue: for a key built from data, such as a theme preset's name
 * (`theme.preset.<name>`), which the compiler can't check.
 */
export function isMessageKey(key: string): key is MessageKey {
  return Object.hasOwn(en, key);
}

/** Keys with a message per plural category: `base.one` and `base.other` (and any of `zero`…). */
export type PluralKey = {
  [K in MessageKey]: K extends `${infer Base}.other`
    ? `${Base}.one` extends MessageKey
      ? Base
      : never
    : never;
}[MessageKey];

/** The plural categories a count can fall in, as `Intl.PluralRules` names them. */
const CATEGORIES = ["zero", "one", "two", "few", "many", "other"] as const;

/** English's plural rules: "1 page", "2 pages". The catalogue is English (Q8). */
const RULES = new Intl.PluralRules("en");

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
  ...[params]: [ParamsOf<`${B}.other`>] extends ["count" | never]
    ? [params?: MessageParams]
    : [params: Readonly<Record<Exclude<ParamsOf<`${B}.other`>, "count">, string | number>>]
): string {
  const category = RULES.select(count);
  const key = (
    CATEGORIES.includes(category) && `${base}.${category}` in en
      ? `${base}.${category}`
      : `${base}.other`
  ) as MessageKey;
  return t(key, { ...(params ?? {}), count });
}
