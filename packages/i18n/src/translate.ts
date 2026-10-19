import { en } from "./en.js";

/** A key of the English message catalogue. */
export type MessageKey = keyof typeof en;

/** Values substituted into `{placeholder}`s of a message. */
export type MessageParams = Readonly<Record<string, string | number>>;

const PLACEHOLDER = /\{(\w+)\}/g;

/**
 * Returns the UI string for `key`, with `{placeholder}`s replaced by `params`.
 * A placeholder without a matching param is left as is, so a missing value is visible in the UI
 * instead of silently disappearing.
 *
 * @example t("app.version", { version: "1.2.0" }) // "Version 1.2.0"
 */
export function t(key: MessageKey, params?: MessageParams): string {
  const message: string = en[key];
  if (params === undefined) {
    return message;
  }
  return message.replace(PLACEHOLDER, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}
