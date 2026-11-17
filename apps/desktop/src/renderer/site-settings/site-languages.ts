/**
 * The languages Site Settings offer by name (6.12, CC-1), as the language codes the site stores
 * (`<html lang>`): the most used in Europe and beyond, with the regional English, French, German,
 * Spanish and Portuguese a small business is likely to pick.
 */
export const SITE_LANGUAGES = [
  "af",
  "ar",
  "bg",
  "bn",
  "ca",
  "cs",
  "cy",
  "da",
  "de",
  "de-AT",
  "de-CH",
  "el",
  "en",
  "en-AU",
  "en-CA",
  "en-GB",
  "en-IE",
  "en-NZ",
  "en-US",
  "en-ZA",
  "es",
  "es-AR",
  "es-MX",
  "et",
  "eu",
  "fa",
  "fi",
  "fr",
  "fr-BE",
  "fr-CA",
  "fr-CH",
  "ga",
  "gl",
  "he",
  "hi",
  "hr",
  "hu",
  "id",
  "is",
  "it",
  "ja",
  "ko",
  "lt",
  "lv",
  "ms",
  "mt",
  "nb",
  "nl",
  "nl-BE",
  "pl",
  "pt",
  "pt-BR",
  "pt-PT",
  "ro",
  "ru",
  "sk",
  "sl",
  "sr",
  "sv",
  "sw",
  "th",
  "tr",
  "uk",
  "ur",
  "vi",
  "zh-Hans",
  "zh-Hant",
] as const;

/** Names of languages in the app's language, English: "German (Austria)". */
const NAMES = new Intl.DisplayNames(["en"], { type: "language", languageDisplay: "standard" });

/** `code`'s name, or the code itself for one without a name. */
function languageName(code: string): string {
  try {
    return NAMES.of(code) ?? code;
  } catch {
    // Not a language code at all.
    return code;
  }
}

/**
 * The languages to choose from, by name in alphabetical order, each storing its code. A site's
 * `current` language not on the list is offered too, shown as its code, so opening Site Settings
 * never changes it.
 */
export function languageOptions(
  current: string,
): readonly { readonly label: string; readonly value: string }[] {
  const listed: readonly string[] = SITE_LANGUAGES;
  const options = SITE_LANGUAGES.map((code) => ({ label: languageName(code), value: code })).sort(
    (a, b) => a.label.localeCompare(b.label, "en"),
  );
  return current === "" || listed.includes(current)
    ? options
    : [{ label: current, value: current }, ...options];
}
