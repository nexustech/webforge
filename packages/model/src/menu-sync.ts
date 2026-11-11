import { newId, type PageId } from "./ids.js";
import type { MenuDoc, MenuItem, MenuLeaf } from "./menu.js";
import type { SiteDoc } from "./site-doc.js";

/** The parts of a site the menu follows. */
type MenuPages = Pick<SiteDoc, "menu" | "pages" | "pageOrder">;

/** Whether `item` still has somewhere to go: a page or section item needs its page. */
function exists(site: MenuPages, item: MenuLeaf): boolean {
  switch (item.kind) {
    case "page":
      return site.pages[item.pageId]?.kind === "page";
    case "section":
      return site.pages[item.link.pageId] !== undefined;
    default:
      return true;
  }
}

/**
 * Whether page `id` is one the menu takes in by itself: a page, not "Page not found", and not a
 * Blog's post, which the Blog lists (6.10a). A post can still be added to an edited menu by hand.
 */
const takenIn = (site: MenuPages, id: PageId) => {
  const page = site.pages[id];
  return page?.kind === "page" && page.collection === undefined;
};

/** A new, shown menu item for page `pageId`. */
const pageItem = (pageId: PageId): MenuItem => ({
  id: newId("menuItem"),
  kind: "page",
  pageId,
  hidden: false,
});

/**
 * The site's menu kept in step with its pages (F-ED-17), for the same step as the page change, so
 * undo restores both together:
 * - while it `follows` the pages, it lists every page (not "Page not found") in page order, keeping
 *   each page's item (and its id); hiding one is the page's own setting; a Blog's posts are left
 *   out, as the Blog lists them (6.10a);
 * - once edited (`custom`), its order is the person's: items of deleted pages, and section links
 *   into them, go, and the page `added` (if any) joins at the end.
 *
 * Renaming needs nothing: a page item shows the page's current navigation label or title.
 */
export function syncMenuWithPages(site: MenuPages, added?: PageId): MenuDoc {
  const { menu } = site;
  if (menu.follows === "pages") {
    const existing = new Map<PageId, MenuItem>(
      menu.items.flatMap((item) => (item.kind === "page" ? [[item.pageId, item] as const] : [])),
    );
    return {
      follows: "pages",
      items: site.pageOrder
        .filter((id) => takenIn(site, id))
        .map((pageId) => existing.get(pageId) ?? pageItem(pageId)),
    };
  }
  const items = menu.items.flatMap((item): MenuItem[] => {
    if (item.kind === "group") {
      const children = item.children.filter((child) => exists(site, child));
      return [children.length === item.children.length ? item : { ...item, children }];
    }
    return exists(site, item) ? [item] : [];
  });
  const listed = (pageId: PageId) =>
    items.some(
      (item) =>
        (item.kind === "page" && item.pageId === pageId) ||
        (item.kind === "group" &&
          item.children.some((child) => child.kind === "page" && child.pageId === pageId)),
    );
  if (added !== undefined && takenIn(site, added) && !listed(added)) {
    items.push(pageItem(added));
  }
  return { follows: "custom", items };
}
