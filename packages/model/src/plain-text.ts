/** The entities rich text's HTML writes: as the sanitiser leaves them. */
const ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  nbsp: " ",
};

/**
 * The text of rich text's `html`, as a visitor reads it: no tags, single spaces. Site Check reads
 * text with it, and the commands compare a generated text's facts with it (#1228).
 */
export function plainText(html: string): string {
  // Most values are plain already: no tags, no entities.
  if (!html.includes("<") && !html.includes("&")) return html.replace(/\s+/g, " ").trim();
  return html
    .replace(/<\/(p|li|h[1-6])>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, name: string) => ENTITIES[name] ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Splits text into what a reader sees as characters: an emoji with its modifiers is one. */
const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/**
 * `text`, shortened to `most` characters as a reader counts them, ending in "…" when it's cut:
 * never cut inside an emoji, which would leave half of it before the "…". A plan's titles (S30)
 * and Site Check's names for an element by its text (#1449) are shortened with it.
 */
export function shortened(text: string, most: number): string {
  // Most texts are short: no need to split them.
  if (text.length <= most) return text;
  const characters = Array.from(GRAPHEMES.segment(text), ({ segment }) => segment);
  return characters.length <= most
    ? text
    : `${characters
        .slice(0, most - 1)
        .join("")
        .trimEnd()}…`;
}
