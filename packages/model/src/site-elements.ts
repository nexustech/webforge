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

/**
 * What {@link eachElement} calls with each element: where it's kept, and what holds it, which is
 * only so during the call (copy it to keep it).
 */
type Visit = (node: NodeDoc, on: ElementPlace, ancestors: readonly NodeDoc[]) => void;

/**
 * Calls `visit` for each of `nodes` and the elements in their slots, depth first, with the
 * elements holding each, outermost first: one array, `ancestors`, kept as the walk goes, so no
 * element costs an array of its own (#670). It holds what it says only during the call.
 */
function walk(
  nodes: readonly NodeDoc[],
  on: ElementPlace,
  visit: Visit,
  skipHidden: boolean,
  ancestors: NodeDoc[] = [],
): void {
  for (const node of nodes) {
    if (skipHidden && node.props.hidden === true) continue;
    visit(node, on, ancestors);
    for (const value of Object.values(node.props)) {
      if (!Array.isArray(value)) continue;
      ancestors.push(node);
      walk(value.filter(isNodeDoc), on, visit, skipHidden, ancestors);
      ancestors.pop();
    }
  }
}

/**
 * Calls `visit` for every element of `site`, with where it is kept: the Header, the Footer, each
 * page in the Pages panel's order, then each shared section once (not its copies). Elements in
 * slots are visited after the element holding them; each with the elements holding it, outermost
 * first (what it's drawn on, #670).
 */
export function eachElement(
  site: SiteDoc,
  visit: Visit,
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
