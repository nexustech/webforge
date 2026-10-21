import { imageValueSchema, isNodeDoc, type NodeDoc, type SiteDoc } from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";

/**
 * The Media ids that `nodes` place in `media` fields, at any depth, hidden elements included:
 * they are still placements, which show the image again once they are shown.
 */
function placedIn(nodes: readonly NodeDoc[], library: ComponentLibrary, into: Set<string>): void {
  for (const node of nodes) {
    const fields = library.components[node.type]?.fields ?? {};
    for (const [name, value] of Object.entries(node.props)) {
      if (fields[name]?.kind === "media") {
        const placed = imageValueSchema.safeParse(value);
        if (placed.success) into.add(placed.data.mediaId);
      } else if (Array.isArray(value)) {
        // Slots, and anything else that holds elements.
        placedIn(value.filter(isNodeDoc), library, into);
      }
    }
  }
}

/**
 * How many pages use each Media item (1.16): in their content, in the Header or Footer they show,
 * or as the image shown when they are shared. Deleting an image that is used warns with this count.
 */
export function mediaUsage(site: SiteDoc, library: ComponentLibrary): ReadonlyMap<string, number> {
  const header = new Set<string>();
  const footer = new Set<string>();
  placedIn(site.layout.header, library, header);
  placedIn(site.layout.footer, library, footer);
  const counts = new Map<string, number>();
  for (const id of site.pageOrder) {
    const page = site.pages[id];
    if (page === undefined) continue;
    const used = new Set<string>();
    placedIn(page.doc.content, library, used);
    if (!page.settings.hideHeader) for (const mediaId of header) used.add(mediaId);
    if (!page.settings.hideFooter) for (const mediaId of footer) used.add(mediaId);
    if (page.settings.shareImage !== undefined) used.add(page.settings.shareImage);
    for (const mediaId of used) counts.set(mediaId, (counts.get(mediaId) ?? 0) + 1);
  }
  return counts;
}
