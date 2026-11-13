/** Dollars as OpenRouter bills them (AIA-8): cents for most, more digits for a fraction of a cent. */
const DOLLARS = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const SMALL = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumSignificantDigits: 2,
});

/**
 * `usd` as money: "$1.25", or "$0.0042" for less than a cent, so a cheap reply doesn't read as
 * free.
 */
export function money(usd: number): string {
  return usd > 0 && usd < 0.01 ? SMALL.format(usd) : DOLLARS.format(usd);
}
