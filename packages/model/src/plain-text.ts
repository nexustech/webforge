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
