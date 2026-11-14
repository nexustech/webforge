import { type Collection, isCollectionIn } from "./collections.js";
import { isNodeDoc, type NodeDoc } from "./documents.js";
import type { CollectionId, PageId, SharedSectionId } from "./ids.js";
import { isKeyOf } from "./records.js";
import { isSharedCopy } from "./shared-sections.js";
import type { SiteDoc } from "./site-doc.js";

/**
 * Where an element is kept: on a page, in the Header or Footer, in a shared section (F-ED-23),
 * whose elements are on every page with a copy of it, or in a collection's design (6.10a, #936),
 * whose elements are on every one of its items, a Blog's posts.
 */
export type ElementPlace = PageId | "header" | "footer" | SharedSectionId | CollectionId;

/** The collection whose design `on` is (#936), if it is one of `site`'s. */
export const designAt = (site: Pick<SiteDoc, "collections">, on: string): Collection | undefined =>
  isCollectionIn(site.collections, on) ? site.collections[on] : undefined;

/**
 * The top-level elements kept `on` in `site`, or in an Immer draft of it: a page's content, the
 * Header's or Footer's, a shared section, or a collection's design, above then below each item's
 * content (#936). A design's is a list of its own, so change its elements, never the list itself.
 * None for a place the site doesn't have.
 */
export function elementsAt(site: SiteDoc, on: string): readonly NodeDoc[] {
  if (on === "header" || on === "footer") return site.layout[on];
  // Their own entries only, so a place such as `constructor` finds nothing.
  if (isKeyOf(site.pages, on)) return site.pages[on]?.doc.content ?? [];
  if (isKeyOf(site.sharedSections, on)) {
    const shared = site.sharedSections[on];
    return shared === undefined ? [] : [shared.section];
  }
  const design = designAt(site, on)?.design;
  return design === undefined ? [] : [...design.before, ...design.after];
}

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
 * page in the Pages panel's order, each shared section once (not its copies), then each
 * collection's design once (#936), not once for each of its items. Elements in
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
  for (const collection of Object.values(site.collections)) {
    walk(
      [...collection.design.before, ...collection.design.after],
      collection.id,
      visit,
      skipHidden,
    );
  }
}

/**
 * A page of `site` holding a copy of shared section `sharedId`, and the copy's id there: where one
 * of its elements is shown. Page `shown` first, if it holds one (#988).
 */
export function pageWithCopy(
  site: SiteDoc,
  sharedId: string,
  shown: PageId,
): { readonly pageId: PageId; readonly copyId: string } | undefined {
  for (const pageId of [shown, ...site.pageOrder]) {
    const copy = site.pages[pageId]?.doc.content
      .filter(isSharedCopy)
      .find((node) => node.props.sharedSectionId === sharedId);
    if (copy !== undefined) return { pageId, copyId: copy.props.id };
  }
  return undefined;
}
