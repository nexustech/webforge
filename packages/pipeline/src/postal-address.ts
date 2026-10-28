import { z } from "zod";

/**
 * A postal address as Google's `LocalBusiness` rich results read it (3.15, SEO-1): schema.org's
 * `PostalAddress`, with only what could be found in what the person typed.
 */
export const postalAddressSchema = z.strictObject({
  "@type": z.literal("PostalAddress"),
  streetAddress: z.string().min(1),
  addressLocality: z.string().min(1).optional(),
  addressRegion: z.string().min(1).optional(),
  postalCode: z.string().min(1).optional(),
  addressCountry: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
});

/** See {@link postalAddressSchema}. */
type PostalAddress = z.infer<typeof postalAddressSchema>;

/**
 * Postcodes by the country that writes them, tried on an address's last part: the UK's
 * (`LA9 7DD`), the US's ZIP code (`62704`, `62704-1234`), the Netherlands' (`1012 AB`), and
 * elsewhere four to six digits (`10115`, `75001`). With no country, as a site in plain `en`, the
 * UK's, then the US's, then any.
 */
const UK_POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2})\b/i;
const ZIP_CODE = /\b(\d{5}(?:-\d{4})?)\b/;
const ANY_POSTCODE = /\b(\d{4,6})\b/;
const POSTCODES: Readonly<Record<string, RegExp>> = {
  GB: UK_POSTCODE,
  US: ZIP_CODE,
  NL: /\b(\d{4} ?[A-Z]{2})\b/i,
};

/** The country in a language tag's region (`en-GB` and `zh-Hant-TW` give `GB` and `TW`), if any. */
function countryOf(language: string): string | undefined {
  return /-([a-z]{2})(?:-|$)/i.exec(language)?.[1]?.toUpperCase();
}

/** The postcode patterns to try for `country`, in order. */
function postcodesFor(country: string | undefined): readonly RegExp[] {
  if (country === undefined) return [UK_POSTCODE, ZIP_CODE, ANY_POSTCODE];
  return [POSTCODES[country] ?? ANY_POSTCODE];
}

/**
 * The address the person typed in Site Settings as a `PostalAddress` (3.15, SEO-1), read as UK
 * and most other addresses are written, a part to a line or between commas:
 * - the street is every part before the last ("Unit 3, Canal Works");
 * - the postcode is found in the last part by the site's country's pattern; a last part that is
 *   only the postcode leaves the part before it as the town;
 * - the town (`addressLocality`) is what is left of the last part; in the US, a state's two
 *   letters beside the ZIP code are its region;
 * - the country is the site's language's region (`en-GB`).
 * What can't be found is left out; a one-part address is all street.
 */
export function postalAddressOf(text: string, language: string): PostalAddress | undefined {
  const parts = text
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter((part) => part !== "");
  if (parts.length === 0) return undefined;
  const country = countryOf(language);
  const found: Partial<PostalAddress> = {};
  if (parts.length > 1) {
    const last = parts.pop() ?? "";
    const postcode = postcodesFor(country)
      .map((pattern) => pattern.exec(last)?.[1])
      .find((each) => each !== undefined);
    let town = last;
    if (postcode !== undefined) {
      found.postalCode = postcode.toUpperCase();
      town = last.replace(postcode, "").trim();
    }
    if (country === "US" && /^[A-Z]{2}$/.test(town)) {
      found.addressRegion = town;
      town = "";
    }
    // "1 High Street, Hightown, LA9 7DD": the town is the part before the postcode's own.
    if (town === "" && parts.length > 1) town = parts.pop() ?? "";
    if (town !== "") found.addressLocality = town;
  }
  return postalAddressSchema.parse({
    "@type": "PostalAddress",
    streetAddress: parts.join(", "),
    ...found,
    ...(country === undefined ? {} : { addressCountry: country }),
  });
}
