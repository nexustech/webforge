import { isNodeDoc, type NodeDoc } from "./documents.js";
import type { PageId } from "./ids.js";
import { pageLinkSchema } from "./link.js";
import type { SiteDoc } from "./site-doc.js";

/** Where a broken link is: the page it is on (or the Header, Footer or menu), and its element. */
export type BrokenLink = {
  /** The page the link is on; `"header"` or `"footer"` for the shared layout, `"menu"`. */
  readonly on: PageId | "header" | "footer" | "menu";
  /** The element holding the link, or the menu item. */
  readonly nodeId: string;
  /** The page it points at. */
  readonly pageId: PageId;
  /** The section it points at, when that is what is missing. */
  readonly anchor?: string;
};

/** The anchors (`advanced.anchorId`) of `nodes` and everything in them. */
function anchorsIn(nodes: readonly unknown[], found = new Set<string>()): Set<string> {
  for (const node of nodes) {
    if (typeof node !== "object" || node === null) continue;
    const props = (node as { props?: Record<string, unknown> }).props ?? {};
    const anchor = (props.advanced as { anchorId?: unknown } | undefined)?.anchorId;
    if (typeof anchor === "string" && anchor !== "") found.add(anchor);
    for (const value of Object.values(props)) {
      if (Array.isArray(value)) anchorsIn(value, found);
    }
  }
  return found;
}

/** Calls `visit` for every page link in `value`, a field's value, but not in elements inside it. */
function walkLinks(
  value: unknown,
  visit: (link: { pageId: PageId; anchor?: string | undefined }) => void,
): void {
  if (Array.isArray(value)) {
    for (const item of value) walkLinks(item, visit);
    return;
  }
  if (typeof value !== "object" || value === null || isNodeDoc(value)) {
    return;
  }
  const link = pageLinkSchema.safeParse(value);
  if (link.success) {
    visit(link.data);
    return;
  }
  for (const item of Object.values(value)) walkLinks(item, visit);
}

/**
 * The links to pages, or sections of pages, that don't exist any more (F-ED-18): the page was
 * deleted, or the section with that anchor was. Site Check lists them (3.6). Links to the Header
 * or Footer's anchors count as found on every page.
 */
export function findBrokenLinks(site: SiteDoc): BrokenLink[] {
  const shared = anchorsIn([...site.layout.header, ...site.layout.footer]);
  const anchorsOf = new Map<PageId, Set<string>>();
  const anchorsOn = (pageId: PageId) => {
    let anchors = anchorsOf.get(pageId);
    if (anchors === undefined) {
      anchors = anchorsIn(site.pages[pageId]?.doc.content ?? [], new Set(shared));
      anchorsOf.set(pageId, anchors);
    }
    return anchors;
  };

  const broken: BrokenLink[] = [];
  const checkLink = (
    on: BrokenLink["on"],
    id: string,
    link: { pageId: PageId; anchor?: string | undefined },
  ) => {
    if (site.pages[link.pageId] === undefined) {
      broken.push({ on, nodeId: id, pageId: link.pageId });
    } else if (link.anchor !== undefined && !anchorsOn(link.pageId).has(link.anchor)) {
      broken.push({ on, nodeId: id, pageId: link.pageId, anchor: link.anchor });
    }
  };
  const check = (on: BrokenLink["on"], nodes: readonly NodeDoc[]) => {
    const visitNode = (node: NodeDoc) => {
      for (const [name, value] of Object.entries(node.props)) {
        if (name === "advanced") continue;
        walkLinks(value, (link) => checkLink(on, node.props.id, link));
        // Elements in slots are checked as themselves, so each link names its own element.
        if (Array.isArray(value)) {
          for (const child of value) {
            if (isNodeDoc(child)) visitNode(child);
          }
        }
      }
    };
    for (const node of nodes) visitNode(node);
  };

  // The navigation menu's page and section items (F-ED-17), dropdowns included.
  for (const item of site.menu.items.flatMap((entry) =>
    entry.kind === "group" ? [entry, ...entry.children] : [entry],
  )) {
    if (item.kind === "page") checkLink("menu", item.id, { pageId: item.pageId });
    else if (item.kind !== "group")
      walkLinks(item.link, (link) => checkLink("menu", item.id, link));
  }

  check("header", site.layout.header);
  check("footer", site.layout.footer);
  for (const id of site.pageOrder) {
    const page = site.pages[id];
    if (page !== undefined) check(id, page.doc.content);
  }
  return broken;
}
