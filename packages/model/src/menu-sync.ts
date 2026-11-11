import { type Collection, collectionById } from "./collections.js";
import { type CollectionId, newId, type PageId } from "./ids.js";
import type { MenuDoc, MenuItem, MenuLeaf } from "./menu.js";
import type { SiteDoc } from "./site-doc.js";

/**
 * The parts of a site the menu follows: its pages, and its collections, whose lists it links to
 * (#940). A caller without collections leaves their items as they are.
 */
type MenuPages = Pick<SiteDoc, "menu" | "pages" | "pageOrder"> & {
  readonly collections?: SiteDoc["collections"];
};

/**
 * Whether `item` still has somewhere to go: a page or section item needs its page, a link to a
 * collection's list its collection (#940).
 */
function exists(site: MenuPages, item: MenuLeaf): boolean {
  switch (item.kind) {
    case "page":
      return site.pages[item.pageId]?.kind === "page";
    case "section":
      return site.pages[item.link.pageId] !== undefined;
    default:
      return (
        item.link.kind !== "list" ||
        site.collections === undefined ||
        collectionById({ collections: site.collections }, item.link.collectionId) !== undefined
      );
  }
}

/** The collection whose list `item` links to, if it is such a link (#940). */
const listOf = (item: MenuItem): CollectionId | undefined =>
  item.kind === "link" && item.link.kind === "list" ? item.link.collectionId : undefined;

/** A new, shown menu item linking to `collection`'s list, by its name (#940). */
const listItem = (collection: Collection): MenuItem => ({
  id: newId("menuItem"),
  kind: "link",
  label: collection.name,
  link: { kind: "list", collectionId: collection.id },
  hidden: false,
});

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
 *   out, as the Blog lists them (6.10a); after the pages, each collection's list, by its name
 *   (#940);
 * - once edited (`custom`), its order is the person's: items of deleted pages, and section links
 *   into them, go, as do links to a collection's list that's gone; the page `added` (if any), and
 *   the list of the collection `addedList` (if any), join at the end.
 *
 * Renaming needs nothing: a page item shows the page's current navigation label or title.
 */
export function syncMenuWithPages(
  site: MenuPages,
  added?: PageId,
  addedList?: CollectionId,
): MenuDoc {
  const { menu } = site;
  if (menu.follows === "pages") {
    const existing = new Map<PageId, MenuItem>(
      menu.items.flatMap((item) => (item.kind === "page" ? [[item.pageId, item] as const] : [])),
    );
    const lists = new Map<string, MenuItem>(
      menu.items.flatMap((item) => {
        const id = listOf(item);
        return id === undefined ? [] : [[id as string, item] as const];
      }),
    );
    // Each list's item keeps its id and hidden state, and shows its collection's name.
    const listItems =
      site.collections === undefined
        ? [...lists.values()]
        : Object.values(site.collections).map((collection): MenuItem => {
            const kept = lists.get(collection.id);
            return kept?.kind === "link"
              ? { ...kept, label: collection.name }
              : listItem(collection);
          });
    return {
      follows: "pages",
      items: [
        ...site.pageOrder
          .filter((id) => takenIn(site, id))
          .map((pageId) => existing.get(pageId) ?? pageItem(pageId)),
        ...listItems,
      ],
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
  const list =
    addedList === undefined || site.collections === undefined
      ? undefined
      : collectionById({ collections: site.collections }, addedList);
  const lists = (id: CollectionId) =>
    items.some(
      (item) =>
        listOf(item) === id ||
        (item.kind === "group" && item.children.some((child) => listOf(child) === id)),
    );
  if (list !== undefined && !lists(list.id)) items.push(listItem(list));
  return { follows: "custom", items };
}
