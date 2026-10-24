import {
  expandSharedCopies,
  imageValueSchema,
  isNodeDoc,
  isSharedCopy,
  linkValueSchema,
  menuFileLinks,
  type NodeDoc,
  richTextFileLinks,
  type SiteDoc,
} from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";

/**
 * The Media ids that `nodes` place in `media` fields or link to (documents, 1.28) in `link`
 * fields or rich text,
 * at any depth, hidden elements included: they are still placements, which show the image again
 * once they are shown.
 */
function placedIn(nodes: readonly NodeDoc[], library: ComponentLibrary, into: Set<string>): void {
  for (const node of nodes) {
    const fields = library.components[node.type]?.fields ?? {};
    for (const [name, value] of Object.entries(node.props)) {
      const kind = fields[name]?.kind;
      if (kind === "media") {
        const placed = imageValueSchema.safeParse(value);
        if (placed.success) into.add(placed.data.mediaId);
      } else if (kind === "link") {
        const link = linkValueSchema.safeParse(value);
        if (link.success && link.data.kind === "file") into.add(link.data.mediaId);
      } else if (kind === "richtext" && typeof value === "string") {
        for (const link of richTextFileLinks(value)) into.add(link.mediaId);
      } else if (Array.isArray(value)) {
        // Slots, and anything else that holds elements.
        placedIn(value.filter(isNodeDoc), library, into);
      }
    }
  }
}

/**
 * Media used by the whole site, so on every page: the site icon, the site's share image, and files
 * the navigation menu links to (menu items hidden in the menu editor included).
 */
function usedSiteWide(site: SiteDoc): Set<string> {
  const used = new Set<string>();
  const { icon } = site.settings.general;
  const { shareImage } = site.settings.social;
  if (icon !== undefined) used.add(icon);
  if (shareImage !== undefined) used.add(shareImage);
  for (const id of menuFileLinks(site.menu)) used.add(id);
  return used;
}

/**
 * How many pages use each Media item (1.16): in their content (placed, or linked to as a document),
 * copies of shared sections included, in the Header or Footer they show,
 * as the image shown when they are shared, or site-wide (the site icon, the site's share image, a
 * file the menu links to). Deleting an item that is used warns with this count.
 */
export function mediaUsage(site: SiteDoc, library: ComponentLibrary): ReadonlyMap<string, number> {
  const siteWide = usedSiteWide(site);
  const header = new Set<string>();
  const footer = new Set<string>();
  placedIn(site.layout.header, library, header);
  placedIn(site.layout.footer, library, footer);
  const counts = new Map<string, number>();
  for (const id of site.pageOrder) {
    const page = site.pages[id];
    if (page === undefined) continue;
    const used = new Set(siteWide);
    // A shared section's images and documents are used on each page with a copy of it (F-ED-23).
    placedIn(expandSharedCopies(page.doc.content, site.sharedSections), library, used);
    if (!page.settings.hideHeader) for (const mediaId of header) used.add(mediaId);
    if (!page.settings.hideFooter) for (const mediaId of footer) used.add(mediaId);
    if (page.settings.shareImage !== undefined) used.add(page.settings.shareImage);
    for (const mediaId of used) counts.set(mediaId, (counts.get(mediaId) ?? 0) + 1);
  }
  return counts;
}

/**
 * The shared sections no page has a copy of that use each Media item, by name (F-ED-23): no page
 * counts them, but placing the section later shows the item, so deleting it still warns.
 */
export function unplacedSharedUsage(
  site: SiteDoc,
  library: ComponentLibrary,
): ReadonlyMap<string, readonly string[]> {
  const placed = new Set(
    Object.values(site.pages).flatMap((page) =>
      page.doc.content.filter(isSharedCopy).map((copy) => copy.props.sharedSectionId),
    ),
  );
  const names = new Map<string, string[]>();
  for (const shared of Object.values(site.sharedSections)) {
    if (placed.has(shared.id)) continue;
    const used = new Set<string>();
    placedIn([shared.section], library, used);
    for (const mediaId of used) names.set(mediaId, [...(names.get(mediaId) ?? []), shared.name]);
  }
  return names;
}
