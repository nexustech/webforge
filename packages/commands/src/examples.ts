import {
  clearExample,
  factDetailsIn,
  findNode,
  markExamples,
  markTestimonial,
  type NodeDoc,
  plainText,
  type SiteDoc,
  siteFactKeys,
  TESTIMONIAL_EXAMPLE,
} from "@webforge/model";
import type { CatalogueField } from "@webforge/site-components/catalogue-data";
import { z } from "zod";

/**
 * What a command that writes text takes besides it (#1228, WN-3): the fields whose new text holds
 * an example, as the app flags them. Optional: Webforge also marks any text holding a detail it
 * can't find the source of.
 */
export const examplesInput = z.array(z.string().min(1).max(64)).max(50).optional();

/** What a text-writing command's description says of `examples`. */
export const EXAMPLES_FIELD =
  "List in examples the fields whose new text holds an example for a fact you weren't given.";

/**
 * What a generated change to `site` may repeat without having made it up: the facts its Site
 * Settings and its text give. Worked out once, and only if a written text has a detail to compare.
 */
export function knownFacts(site: SiteDoc): () => ReadonlySet<string> {
  return () => {
    let known = KNOWN.get(site);
    if (known === undefined) {
      known = siteFactKeys(site);
      KNOWN.set(site, known);
    }
    return known;
  };
}

/**
 * The facts each site gives, by the site as a plan's steps see it: a plan of many steps on one
 * site works them out once. A site that changes is another object, and nothing holds an old one.
 */
const KNOWN = new WeakMap<SiteDoc, ReadonlySet<string>>();

/**
 * Marks the text fields of `node`, a draft, that a command wrote with `values` (#1228, WN-3): each
 * one the app `flagged`, each whose text holds a detail shaped like a fact that appears nowhere in
 * `known`, and every field of a testimonial, which is always an example. A text written without
 * one is the app's own, and loses a mark it had. Fields that aren't text are left as they are.
 */
export function markWritten(
  node: NodeDoc,
  fields: Readonly<Record<string, CatalogueField>>,
  values: Readonly<Record<string, unknown>>,
  flagged: readonly string[] | undefined,
  known: () => ReadonlySet<string>,
): void {
  const flags = new Set(flagged);
  const marked: string[] = [];
  for (const [name, value] of Object.entries(values)) {
    const kind = fields[name]?.kind;
    if ((kind !== "text" && kind !== "richtext") || typeof value !== "string") continue;
    const details = flags.has(name) ? [] : factDetailsIn(plainText(value));
    const made = flags.has(name) || details.some(({ key }) => !known().has(key));
    if (made) marked.push(name);
    else clearExample(node.props, name);
  }
  markExamples(node.props, marked);
  // A testimonial written, or one in a section added with its testimonials: always an example.
  findNode([node], (each) => {
    if (each.type === TESTIMONIAL_EXAMPLE.type) markTestimonial(each.props);
    return false;
  });
}
