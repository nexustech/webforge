/**
 * How a component writes the page's main heading, `<h1>` (#982), which Site Check counts: from
 * the text in `field`, while the fields in `when` have those values (a Heading's size, large), or,
 * with `html`, each `<h1>` in that field's own HTML (Custom Code's).
 */
export type MainHeading = {
  readonly field: string;
  readonly when?: { readonly [field: string]: string | undefined } | undefined;
  readonly html?: true | undefined;
};

/** `<h1>` start tags in HTML of a component's own. */
const H1_TAG = /<h1[\s>]/gi;

/** `text` has words in it, formatting aside. */
const hasWords = (text: unknown) =>
  typeof text === "string" && text.replace(/<[^>]*>/g, "").trim() !== "";

/**
 * How many main headings a component with `heading` writes with `values`: none for one without.
 * React-free, so Site Check reads it from the catalogue as data.
 */
export function mainHeadingsOf(
  heading: MainHeading | undefined,
  values: Readonly<Record<string, unknown>>,
): number {
  if (heading === undefined) return 0;
  for (const [field, value] of Object.entries(heading.when ?? {})) {
    if (value !== undefined && values[field] !== value) return 0;
  }
  const text = values[heading.field];
  if (heading.html === true)
    return typeof text === "string" ? (text.match(H1_TAG)?.length ?? 0) : 0;
  return hasWords(text) ? 1 : 0;
}
