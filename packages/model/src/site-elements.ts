import { isNodeDoc, type NodeDoc } from "./documents.js";
import type { PageId, SharedSectionId } from "./ids.js";
import type { SiteDoc } from "./site-doc.js";

/**
 * Where an element is kept: on a page, in the Header or Footer, or in a shared section (F-ED-23),
 * whose elements are on every page with a copy of it.
 */
export type ElementPlace = PageId | "header" | "footer" | SharedSectionId;

/** What {@link eachElement} walks over. */
type EachElementOptions = {
  /** Leaves out elements hidden in Layers, and everything in them: what the export leaves out. */
  readonly skipHidden?: boolean;
};

/** Calls `visit` for each of `nodes` and the elements in their slots, depth first. */
function walk(
  nodes: readonly NodeDoc[],
  on: ElementPlace,
  visit: (node: NodeDoc, on: ElementPlace) => void,
  skipHidden: boolean,
): void {
  for (const node of nodes) {
    if (skipHidden && node.props.hidden === true) continue;
    visit(node, on);
    for (const value of Object.values(node.props)) {
      if (Array.isArray(value)) walk(value.filter(isNodeDoc), on, visit, skipHidden);
    }
  }
}

/**
 * Calls `visit` for every element of `site`, with where it is kept: the Header, the Footer, each
 * page in the Pages panel's order, then each shared section once (not its copies). Elements in
 * slots are visited after the element holding them.
 */
export function eachElement(
  site: SiteDoc,
  visit: (node: NodeDoc, on: ElementPlace) => void,
  { skipHidden = false }: EachElementOptions = {},
): void {
  walk(site.layout.header, "header", visit, skipHidden);
  walk(site.layout.footer, "footer", visit, skipHidden);
  for (const id of site.pageOrder) {
    const page = site.pages[id];
    if (page !== undefined) walk(page.doc.content, id, visit, skipHidden);
  }
  for (const entry of Object.values(site.sharedSections)) {
    walk([entry.section], entry.id, visit, skipHidden);
  }
}
