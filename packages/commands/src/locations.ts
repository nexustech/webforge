import { isNodeDoc, isSharedCopy, type NodeDoc, type PageId, type SiteDoc } from "@webforge/model";
import { z } from "zod";

/**
 * Where elements live: a page's content, the Header or Footer every page shares, or a shared
 * section's own section (which its linked copies on pages show).
 */
export const locationSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("page"), pageId: z.string().min(1).max(64) }),
  z.strictObject({ kind: z.literal("layout"), part: z.enum(["header", "footer"]) }),
  z.strictObject({ kind: z.literal("shared"), sharedSectionId: z.string().min(1).max(64) }),
]);

/** See {@link locationSchema}. */
export type Location = z.infer<typeof locationSchema>;

/**
 * The top-level nodes at `location` in `site`, the array itself (a draft's, to change), or none
 * when the page or shared section isn't there. A shared section's is its one section.
 */
export function nodesAt(site: SiteDoc, location: Location): NodeDoc[] | undefined {
  switch (location.kind) {
    case "page":
      return site.pages[location.pageId as PageId]?.doc.content;
    case "layout":
      return site.layout[location.part];
    case "shared": {
      const shared = site.sharedSections[location.sharedSectionId as never];
      return shared === undefined ? undefined : [shared.section];
    }
  }
}

/** A node and where it sits: its parent and slot (none at the top level), and its list. */
export type Placed = {
  readonly node: NodeDoc;
  readonly parent: NodeDoc | null;
  readonly slot: string | null;
  readonly list: NodeDoc[];
  readonly index: number;
};

/** The node `id` in `nodes` or their slots, and where it sits. */
export function locate(
  nodes: NodeDoc[],
  id: string,
  parent: NodeDoc | null = null,
  slot: string | null = null,
): Placed | undefined {
  for (const [index, node] of nodes.entries()) {
    if (node.props.id === id) return { node, parent, slot, list: nodes, index };
    for (const [name, value] of Object.entries(node.props)) {
      if (!isSlot(value)) continue;
      const found = locate(value, id, node, name);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/** Whether `value` is a slot's list of nodes, not a list field's plain items. */
export function isSlot(value: unknown): value is NodeDoc[] {
  return Array.isArray(value) && value.every(isNodeDoc);
}

/** Whether `ancestor` holds `id` in one of its slots, at any depth. */
export function holds(ancestor: NodeDoc, id: string): boolean {
  return Object.values(ancestor.props).some(
    (value) => isSlot(value) && locate(value, id) !== undefined,
  );
}

/** The pages that show `location`'s elements: the Header or Footer, or a shared section's copies. */
export function pagesShowing(site: SiteDoc, location: Location): number {
  const pages = site.pageOrder.flatMap((id) => {
    const page = site.pages[id];
    return page === undefined ? [] : [page];
  });
  switch (location.kind) {
    case "page":
      return 1;
    case "layout":
      return pages.filter((page) =>
        location.part === "header" ? !page.settings.hideHeader : !page.settings.hideFooter,
      ).length;
    case "shared":
      return pages.filter((page) => hasCopy(page.doc.content, location.sharedSectionId)).length;
  }
}

/** Whether `nodes` hold a linked copy of the shared section `id`. */
function hasCopy(nodes: readonly NodeDoc[], id: string): boolean {
  return nodes.some(
    (node) =>
      (isSharedCopy(node) && node.props.sharedSectionId === id) ||
      Object.values(node.props).some((value) => isSlot(value) && hasCopy(value, id)),
  );
}
