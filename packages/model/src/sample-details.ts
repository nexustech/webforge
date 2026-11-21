/**
 * Details shaped like facts about a business but made up, as a template's samples are (#1254): an
 * email address at a domain kept for examples, or a phone number kept for use in drama and
 * examples. A site that still has one hasn't had the business's own put in, and would publish a
 * made-up detail as the business's. 5.33 (WN-3) widens what counts as an example a generated site
 * has; these stay the test for the fact-shaped ones.
 */

/** Domains kept for examples (RFC 2606, RFC 6761): mail sent there goes nowhere. */
const EXAMPLE_DOMAIN = /(^|\.)example\.(com|org|net)$|\.(example|test|invalid)$/i;

/** Whether `address`, an email address, is at a domain kept for examples: `hello@example.com`. */
export function isSampleEmail(address: string): boolean {
  const at = address.lastIndexOf("@");
  return at !== -1 && EXAMPLE_DOMAIN.test(address.slice(at + 1).trim());
}

/**
 * The first eight digits of the UK's numbers for drama and examples (Ofcom): each block is the
 * eight digits and any three after them, such as 01632 960 000 to 960 999.
 */
const UK_SAMPLE_BLOCKS: ReadonlySet<string> = new Set([
  ...["0113", "0114", "0115", "0116", "0117", "0118", "0121", "0131", "0141", "0151", "0161"].map(
    (area) => `${area}4960`,
  ),
  "01914980",
  "02079460",
  "02896496",
  "02920180",
  "01632960",
  "07700900",
  "08081570",
  "09098790",
  "03069990",
]);

/**
 * Whether `number`, a phone number as written, is one kept for drama and examples: a UK one
 * (Ofcom's, such as `+44 1632 960 123` or `020 7946 0000`), or a North American 555-0100 to
 * 555-0199.
 */
export function isSamplePhone(number: string): boolean {
  const trimmed = number.trim();
  const digits = trimmed.replace(/\D/g, "");
  // The UK's, written nationally or from abroad.
  const uk = trimmed.startsWith("+44")
    ? `0${digits.slice(2)}`
    : digits.startsWith("0044")
      ? `0${digits.slice(4)}`
      : digits;
  if (uk.length === 11 && UK_SAMPLE_BLOCKS.has(uk.slice(0, 8))) return true;
  // North America's: an area code, then 555-01xx.
  const nanp = trimmed.startsWith("+1") || digits.length === 11 ? digits.slice(1) : digits;
  return nanp.length === 10 && !nanp.startsWith("0") && nanp.slice(3, 8) === "55501";
}

/** An email address in running text. */
const EMAIL_IN_TEXT = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
/** A phone number in running text: digits, with the spaces, brackets and dashes they're written with. */
const PHONE_IN_TEXT = /\+?\d[\d\s().-]{6,}\d/g;

/** The made-up email addresses and phone numbers in `text`, as written there. */
export function sampleDetailsIn(text: string): readonly string[] {
  return [
    ...[...text.matchAll(EMAIL_IN_TEXT)].map(([found]) => found).filter(isSampleEmail),
    ...[...text.matchAll(PHONE_IN_TEXT)].map(([found]) => found.trim()).filter(isSamplePhone),
  ];
}
