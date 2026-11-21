/**
 * Details in a text shaped like facts about a business (#1228, WN-3): phone numbers, email and web
 * addresses, times and days, prices and postcodes. A generated text with one that appears nowhere
 * the person gave it (what they typed, Site Settings, the site as it was) made it up, and is
 * marked as holding an example. Each detail has a key, the same however it's written ("9am" and
 * "09:00", "+44 1632 960123" and "01632 960123"), to compare with.
 */

import type { SiteSettings } from "./settings.js";

/** A kind of detail shaped like a fact. */
export type FactKind = "email" | "web" | "phone" | "price" | "time" | "day" | "postcode";

/** One detail found in a text: its kind, as written there, and its key for comparing. */
export type FactDetail = {
  readonly kind: FactKind;
  readonly text: string;
  readonly key: string;
};

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
/** A web address: with its scheme or `www.`, or a host on a common ending (`rosas.co.uk`). */
const WEB =
  /\b(?:https?:\/\/|www\.)[^\s<>"')]+|\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:com|co\.uk|org\.uk|org|net|uk|io|shop|biz|info|ie)\b(?:\/[^\s<>"')]*)?/gi;
/** A phone number: digits, with the spaces, brackets and dashes they're written with. */
const PHONE = /\+?\d[\d\s().-]{6,}\d/g;
/** A price: a currency sign and an amount, or an amount and a currency's code. */
const PRICE = /[£$€]\s?\d[\d,]*(?:\.\d{1,2})?|\b\d[\d,]*(?:\.\d{1,2})?\s?(?:GBP|USD|EUR)\b/g;
/** A time: `9am`, `9.30 pm`, `17:30`. */
const TIME = /\b(\d{1,2})(?:[:.](\d{2}))?\s?([ap])\.?m\.?\b|\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/gi;
/** A day of the week, in full or as written short with a capital: `Monday`, `Tue`. */
const DAY =
  /\b(?:(?:[Mm]on|[Tt]ues|[Ww]ednes|[Tt]hurs|[Ff]ri|[Ss]atur|[Ss]un)day|Mon|Tue|Tues|Wed|Thu|Thur|Thurs|Fri|Sat|Sun)s?\b/g;
/** A UK postcode: `HT1 2AB`, `SW1A 1AA`. */
const POSTCODE = /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/g;

/** The fewest digits a phone number has: fewer is a year, a count or a date. */
const PHONE_DIGITS_MIN = 9;

/** A phone number's key: its digits, a UK one written from abroad as written at home. */
function phoneKey(number: string): string {
  const digits = number.replace(/\D/g, "");
  if (number.trim().startsWith("+44")) return `0${digits.slice(2)}`;
  if (digits.startsWith("0044")) return `0${digits.slice(4)}`;
  return digits;
}

/** A time's key: 24-hour `hh:mm`. */
function timeKey(match: RegExpMatchArray): string {
  const [, hour12, minutes12, half, hour24, minutes24] = match;
  if (hour24 !== undefined) return `${hour24.padStart(2, "0")}:${minutes24 ?? "00"}`;
  const hour = (Number(hour12) % 12) + (half?.toLowerCase() === "p" ? 12 : 0);
  return `${String(hour).padStart(2, "0")}:${minutes12 ?? "00"}`;
}

/** The three-letter key of a day's name: `mon`… `sun`. */
const dayKey = (day: string) => day.slice(0, 3).toLowerCase();

/** Every detail shaped like a fact in `text`, plain text, in the order of kinds above. */
export function factDetailsIn(text: string): readonly FactDetail[] {
  const found: FactDetail[] = [];
  const add = (kind: FactKind, written: string, key: string) =>
    found.push({ kind, text: written.trim(), key: `${kind}:${key}` });
  const emails = [...text.matchAll(EMAIL)].map(([email]) => email);
  for (const email of emails) add("email", email, email.toLowerCase());
  // The rest are looked for with the email addresses out of the way: their hosts aren't web
  // addresses, nor their digits phone numbers.
  let rest = emails.reduce((left, email) => left.replace(email, " "), text);
  for (const [found] of rest.matchAll(WEB)) {
    // Not the full stop or colon after it.
    const web = found.replace(/[.,:;!?]+$/, "");
    add(
      "web",
      web,
      web
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/\/$/, ""),
    );
  }
  rest = rest.replace(WEB, " ");
  for (const [price] of rest.matchAll(PRICE)) {
    const amount = Number(price.replace(/[^\d.]/g, ""));
    add("price", price, amount.toFixed(2));
  }
  rest = rest.replace(PRICE, " ");
  for (const [phone] of rest.matchAll(PHONE)) {
    if (phone.replace(/\D/g, "").length >= PHONE_DIGITS_MIN) add("phone", phone, phoneKey(phone));
  }
  for (const time of rest.matchAll(TIME)) add("time", time[0], timeKey(time));
  for (const [day] of rest.matchAll(DAY)) add("day", day, dayKey(day));
  for (const [postcode] of rest.matchAll(POSTCODE)) {
    add("postcode", postcode, postcode.replace(/\s/g, ""));
  }
  return found;
}

/** The keys of every detail in `texts`: what the person gave, to compare a generated text with. */
export const factKeysIn = (texts: Iterable<string>): ReadonlySet<string> =>
  new Set([...texts].flatMap((text) => factDetailsIn(text).map(({ key }) => key)));

/** The details in `text` that appear nowhere in `known` (from {@link factKeysIn}): made up. */
export const unknownFactsIn = (text: string, known: ReadonlySet<string>): readonly FactDetail[] =>
  factDetailsIn(text).filter(({ key }) => !known.has(key));

/** Every string in `value`, at any depth. */
function stringsIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (typeof value === "object" && value !== null) return Object.values(value).flatMap(stringsIn);
  return [];
}

/**
 * The keys of every detail Site Settings give: the business's contact details, web address and
 * profiles as written, and its opening hours' days and times as they're stored (`tue`, `07:00`).
 */
export function settingsFactKeys(settings: SiteSettings): ReadonlySet<string> {
  const keys = new Set(factKeysIn(stringsIn(settings)));
  for (const { days, opens, closes } of settings.contact.openingHours) {
    for (const day of days) keys.add(`day:${day}`);
    keys.add(`time:${opens}`);
    keys.add(`time:${closes}`);
  }
  return keys;
}
