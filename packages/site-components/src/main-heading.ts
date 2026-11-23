import { isNodeDoc, type NodeDoc } from "@webforge/model";

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

/**
 * What a kind of component says about a page's main heading: how it writes one of its own
 * (`mainHeading`), and the field its title is in (`titleField`), a titled section's, which is the
 * page's main heading on a page with none of its own (#1173).
 */
export type HeadingKind = {
  readonly mainHeading?: MainHeading | undefined;
  readonly titleField?: string | undefined;
  /**
   * Nothing in it writes the page's main heading, at any depth: a Footer column's (5.39), whose
   * large Heading is an `<h2>` in the look of an `<h1>`.
   */
  readonly noMainHeading?: true | undefined;
};

/** A page's main headings, as {@link pageHeadings} finds them. */
export type PageHeadings = {
  /** The main headings, `<h1>`, it writes of its own: a Hero's title, a large Heading, Custom Code's. */
  readonly own: number;
  /**
   * The section whose title is its main heading instead, by id, on a page with none of its own: its
   * first section with a title. None on a page with one of its own, or without a titled section.
   */
  readonly promoted: string | undefined;
};

/**
 * How many main headings `nodes` write, at any depth, hidden ones left out, and those in a
 * component that holds none (`noMainHeading`) too.
 */
function ownHeadings(
  nodes: readonly NodeDoc[],
  kindOf: (type: string) => HeadingKind | undefined,
): number {
  let count = 0;
  for (const node of nodes) {
    const kind = kindOf(node.type);
    if (node.props.hidden === true || kind?.noMainHeading === true) continue;
    count += mainHeadingsOf(kind?.mainHeading, node.props);
    for (const value of Object.values(node.props)) {
      if (Array.isArray(value)) count += ownHeadings(value.filter(isNodeDoc), kindOf);
    }
  }
  return count;
}

/**
 * A page's main headings (#982, #1173), from `regions`, what it shows in order: its Header, its
 * content and its Footer (a post's Blog design around its content, in whichever region). Its own,
 * and, when it has none, the first section shown whose title has words, which writes its title as
 * the page's `<h1>` in the look of a section's title. The one rule the canvas, the export and Site
 * Check all follow, so the heading the canvas draws is the one exported and the one Site Check
 * counts. React-free, so Site Check reads `kindOf` from the catalogue as data.
 */
export function pageHeadings(
  regions: readonly (readonly NodeDoc[])[],
  kindOf: (type: string) => HeadingKind | undefined,
): PageHeadings {
  const own = regions.reduce((count, nodes) => count + ownHeadings(nodes, kindOf), 0);
  if (own > 0) return { own, promoted: undefined };
  const titled = regions.flat().find((node) => {
    const field = kindOf(node.type)?.titleField;
    return node.props.hidden !== true && field !== undefined && hasWords(node.props[field]);
  });
  return { own, promoted: titled?.props.id };
}
