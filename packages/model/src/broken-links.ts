import { anchorsIn, isNodeDoc } from "./documents.js";
import type { MediaId, PageId } from "./ids.js";
import { linkValueSchema } from "./link.js";
import { richTextFileLinks, richTextPageLinks } from "./rich-text-links.js";
import { expandSharedCopies } from "./shared-sections.js";
import type { SiteDoc } from "./site-doc.js";
import { type ElementPlace, eachElement } from "./site-elements.js";

/**
 * Where a broken link is: the page it is on (or the Header, Footer or menu), and its element; and
 * what it points at that is gone, a page (or a section of one) or a document in Media (1.28).
 */
export type BrokenLink = {
  /**
   * The page the link is on; `"header"` or `"footer"` for the shared layout, `"menu"`, or a shared
   * section's id (F-ED-23): a link there is on every page with a copy of it.
   */
  readonly on: ElementPlace | "menu";
  /** The element holding the link, or the menu item. */
  readonly nodeId: string;
} & (
  | {
      /** The page it points at. */
      readonly pageId: PageId;
      /** The section it points at, when that is what is missing. */
      readonly anchor?: string;
    }
  | {
      /** The document it points at, deleted from Media. */
      readonly mediaId: MediaId;
    }
);

/** What a link points at in the site: a page (and section), or a document in Media. */
export type SiteTarget =
  | { readonly kind: "page"; readonly pageId: PageId; readonly anchor?: string | undefined }
  | { readonly kind: "file"; readonly mediaId: MediaId };

/**
 * Calls `visit` for every link to a page or a document in `value`, a field's value, but not in
 * elements inside it: link values, and links in rich text's HTML.
 */
function walkLinks(value: unknown, visit: (link: SiteTarget) => void): void {
  if (typeof value === "string") {
    // Most strings are plain text or ids: only one with a link in it is worth the patterns.
    if (!value.includes("href=")) return;
    for (const link of richTextPageLinks(value)) visit({ kind: "page", ...link });
    for (const { mediaId } of richTextFileLinks(value)) visit({ kind: "file", mediaId });
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walkLinks(item, visit);
    return;
  }
  if (typeof value !== "object" || value === null || isNodeDoc(value)) {
    return;
  }
  // Every link value has a kind; anything else (a padding, a list item) is only looked inside.
  const link = "kind" in value ? linkValueSchema.safeParse(value) : undefined;
  if (link?.success === true) {
    if (link.data.kind === "page") visit(link.data);
    if (link.data.kind === "file") visit({ kind: "file", mediaId: link.data.mediaId });
    return;
  }
  for (const item of Object.values(value)) walkLinks(item, visit);
}

/**
 * Calls `visit` for every link in `site` to one of its pages (or a section of one) or documents,
 * with where it is: the navigation menu's items (dropdowns included), then each element's links,
 * in {@link eachElement}'s order. An element's links are its own, not those of the elements in its
 * slots, which are visited as themselves. `skipHidden` leaves out elements hidden in Layers.
 */
export function eachLink(
  site: SiteDoc,
  visit: (on: BrokenLink["on"], nodeId: string, link: SiteTarget) => void,
  { skipHidden = false }: { readonly skipHidden?: boolean } = {},
): void {
  // The navigation menu's page and section items (F-ED-17), dropdowns included.
  for (const item of site.menu.items.flatMap((entry) =>
    entry.kind === "group" ? [entry, ...entry.children] : [entry],
  )) {
    if (item.kind === "page") visit("menu", item.id, { kind: "page", pageId: item.pageId });
    else if (item.kind !== "group") walkLinks(item.link, (link) => visit("menu", item.id, link));
  }
  eachElement(
    site,
    (node, on) => {
      for (const [name, value] of Object.entries(node.props)) {
        if (name !== "advanced") walkLinks(value, (link) => visit(on, node.props.id, link));
      }
    },
    { skipHidden },
  );
}

/**
 * The links to pages, sections of pages or documents that don't exist any more (F-ED-18, 1.28):
 * the page was deleted, or the section with that anchor was, or the document was deleted from
 * Media. Site Check lists them (3.6), leaving out those in hidden elements (`skipHidden`), which
 * aren't exported. Links to the Header or Footer's anchors count as found on every page.
 */
export function findBrokenLinks(
  site: SiteDoc,
  options: { readonly skipHidden?: boolean } = {},
): BrokenLink[] {
  const shared = anchorsIn([...site.layout.header, ...site.layout.footer]);
  const anchorsOf = new Map<PageId, Set<string>>();
  const anchorsOn = (pageId: PageId) => {
    let anchors = anchorsOf.get(pageId);
    if (anchors === undefined) {
      // Copies of shared sections included, with the anchors they have on this page.
      const content = site.pages[pageId]?.doc.content ?? [];
      anchors = anchorsIn(expandSharedCopies(content, site.sharedSections), new Set(shared));
      anchorsOf.set(pageId, anchors);
    }
    return anchors;
  };

  const broken: BrokenLink[] = [];
  eachLink(
    site,
    (on, id, link) => {
      if (link.kind === "file") {
        const item = Object.hasOwn(site.media, link.mediaId) ? site.media[link.mediaId] : undefined;
        if (item?.kind !== "file") broken.push({ on, nodeId: id, mediaId: link.mediaId });
      } else if (site.pages[link.pageId] === undefined) {
        broken.push({ on, nodeId: id, pageId: link.pageId });
      } else if (link.anchor !== undefined && !anchorsOn(link.pageId).has(link.anchor)) {
        broken.push({ on, nodeId: id, pageId: link.pageId, anchor: link.anchor });
      }
    },
    options,
  );
  return broken;
}
