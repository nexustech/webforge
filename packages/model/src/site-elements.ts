import { type Collection, isCollectionIn } from "./collections.js";
import { isNodeDoc, type NodeDoc } from "./documents.js";
import type { CollectionId, PageId, SharedSectionId } from "./ids.js";
import { isDraftPage } from "./published-site.js";
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

/** An element set to Don't Publish that no such element holds, and where it's kept (#1512). */
export type UnpublishedRoot = { readonly node: NodeDoc; readonly on: ElementPlace };

/** Adds to `found` each element of `nodes` (kept `on`) set to Don't Publish with none such holding it. */
function rootsIn(
  nodes: readonly NodeDoc[],
  on: ElementPlace,
  found: UnpublishedRoot[],
): UnpublishedRoot[] {
  walk(
    nodes,
    on,
    (node, place, ancestors) => {
      if (node.props.hidden === true && !ancestors.some((held) => held.props.hidden === true)) {
        found.push({ node, on: place });
      }
    },
    false,
  );
  return found;
}

/**
 * The shared sections in `content`, a page's top level, that a copy shows: one not set to Don't
 * Publish there. A copy that is counts as itself, so what's in it doesn't count again.
 */
const shownSharedSections = (content: readonly NodeDoc[]): SharedSectionId[] =>
  content
    .filter(isSharedCopy)
    .filter((copy) => copy.props.hidden !== true)
    .map((copy) => copy.props.sharedSectionId);

/** The elements left out of page `pageId` of `site`, in the order it's drawn (#1512). */
function pageRoots(site: SiteDoc, pageId: PageId): UnpublishedRoot[] {
  const page = site.pages[pageId];
  if (page === undefined) return [];
  const found: UnpublishedRoot[] = [];
  if (page.settings.hideHeader !== true) rootsIn(site.layout.header, "header", found);
  const design = page.collection === undefined ? undefined : designAt(site, page.collection);
  if (design !== undefined) rootsIn(design.design.before, design.id, found);
  rootsIn(page.doc.content, pageId, found);
  for (const shared of shownSharedSections(page.doc.content)) {
    const entry = site.sharedSections[shared];
    if (entry !== undefined) rootsIn([entry.section], entry.id, found);
  }
  if (design !== undefined) rootsIn(design.design.after, design.id, found);
  if (page.settings.hideFooter !== true) rootsIn(site.layout.footer, "footer", found);
  return found;
}

/**
 * The elements set to **Don't Publish** in `site` (#1512), as the canvas badges them: the outermost
 * only, so a section left out with five elements in it counts once. With `page`, those left out of
 * that page, as Preview draws it: its own, the Header's and Footer's unless it hides them, those of
 * the shared sections it shows and of its collection's design. Without, those of the whole site as
 * it's published: each place once, the Header's and Footer's and a shared section's only while a
 * published page shows them, a design's only while it has a published item, and none on a draft
 * page.
 */
export function unpublishedRoots(
  site: SiteDoc,
  { page }: { readonly page?: PageId } = {},
): UnpublishedRoot[] {
  if (page !== undefined) return pageRoots(site, page);
  const published = site.pageOrder.flatMap((id) => {
    const entry = site.pages[id];
    return entry === undefined || isDraftPage(site, entry) ? [] : [entry];
  });
  const found: UnpublishedRoot[] = [];
  if (published.some((entry) => entry.settings.hideHeader !== true)) {
    rootsIn(site.layout.header, "header", found);
  }
  if (published.some((entry) => entry.settings.hideFooter !== true)) {
    rootsIn(site.layout.footer, "footer", found);
  }
  for (const entry of published) rootsIn(entry.doc.content, entry.id, found);
  const shown = new Set(published.flatMap((entry) => shownSharedSections(entry.doc.content)));
  for (const entry of Object.values(site.sharedSections)) {
    if (shown.has(entry.id)) rootsIn([entry.section], entry.id, found);
  }
  const designs = new Set(
    published.flatMap((entry) => (entry.collection === undefined ? [] : [entry.collection])),
  );
  for (const collection of Object.values(site.collections)) {
    if (designs.has(collection.id)) {
      rootsIn([...collection.design.before, ...collection.design.after], collection.id, found);
    }
  }
  return found;
}
