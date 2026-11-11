import {
  listPath,
  type MenuDoc,
  type MenuLeaf,
  type NodeDoc,
  type SitePage,
} from "@webforge/model";
import { hrefFor } from "./links.js";
import type { NavItem, NavLink } from "./schema.js";

/** What the navigation needs of a page: where it is, its names and whether it is hidden. */
export type NavigationPage = Pick<
  SitePage,
  "id" | "path" | "title" | "navLabel" | "hideFromNavigation"
>;

/** What the navigation needs of a site: its pages, in order, its menu, and its collections. */
export type NavigationSite = {
  readonly pages: readonly NavigationPage[];
  readonly menu?: MenuDoc | undefined;
  /** Where each collection's list is (#940), which a menu item can link to: a Blog's own page. */
  readonly collections?: readonly { readonly id: string; readonly folder: string }[] | undefined;
};

/** Where the list of collection `id` of `site` is, `blog/index`, if the site has it. */
export function listPathOf(
  site: Pick<NavigationSite, "collections">,
  id: string,
): string | undefined {
  const collection = site.collections?.find((each) => each.id === id);
  return collection === undefined ? undefined : listPath(collection.folder);
}

/**
 * The navigation the Header shows on `page` (F-ED-17), with URLs relative to it (`prefix` is its
 * `../` per folder). It comes from the site's menu: a page item shows its page's navigation label
 * or title unless it has a name of its own; links, sections and buttons go where their link goes;
 * dropdowns hold their items. An item is left out when it is hidden in the menu, or its page is
 * hidden from navigation in Page Settings ("Page not found" always is), as is a dropdown left
 * empty. A link that goes nowhere (its page deleted, or its document deleted from Media) is left
 * out too and reported through `broken`. A link to a document goes to its exported file, as
 * `pathOfFile` gives it (1.28). Without a menu, the navigation lists the pages in order. The
 * export and the editor's canvas both use it, so the canvas shows the navigation the export will
 * have.
 */
export function navigationFor(
  site: NavigationSite,
  page: NavigationPage,
  prefix: string,
  broken: (detail: string) => void,
  pathOfFile?: (mediaId: string) => string | undefined,
): NavItem[] {
  const shown = (other: NavigationPage) => other.hideFromNavigation !== true;
  const pageLink = (other: NavigationPage, id: string, label?: string): NavLink => ({
    id,
    label: label ?? other.navLabel ?? other.title,
    href: `${prefix}${other.path}.html`,
    current: other.path === page.path,
  });
  if (site.menu === undefined) {
    return site.pages.filter(shown).map((other) => pageLink(other, other.id));
  }

  const pages = new Map(site.pages.map((other) => [other.id as string, other]));
  const leaf = (item: MenuLeaf): NavLink | undefined => {
    if (item.hidden) return undefined;
    if (item.kind === "page") {
      const target = pages.get(item.pageId);
      return target === undefined || !shown(target)
        ? undefined
        : pageLink(target, item.id, item.label);
    }
    const href = hrefFor(
      item.link,
      (id) => pages.get(id)?.path,
      prefix,
      pathOfFile,
      (id) => listPathOf(site, id),
    );
    if (href === undefined) {
      const { link } = item;
      broken(
        link.kind === "page"
          ? link.pageId
          : link.kind === "file"
            ? link.mediaId
            : link.kind === "list"
              ? link.collectionId
              : link.kind,
      );
      return undefined;
    }
    const link = item.link;
    // The current page's own item: its page, or the list it is the first page of (#940).
    const current =
      (link.kind === "page" &&
        link.anchor === undefined &&
        pages.get(link.pageId)?.path === page.path) ||
      (link.kind === "list" && listPathOf(site, link.collectionId) === page.path);
    return {
      id: item.id,
      label: item.label,
      href,
      current,
      ...(item.kind === "button" ? { button: true } : {}),
      ...(link.newTab === true ? { newTab: true } : {}),
      ...(link.kind === "file" && link.download === true ? { download: true } : {}),
    };
  };

  return site.menu.items.flatMap((item): NavItem[] => {
    if (item.kind !== "group") {
      const link = leaf(item);
      return link === undefined ? [] : [link];
    }
    if (item.hidden) return [];
    const children = item.children.flatMap((child) => {
      const link = leaf(child);
      return link === undefined ? [] : [link];
    });
    return children.length === 0
      ? []
      : [
          {
            id: item.id,
            label: item.label,
            children,
            current: children.some((child) => child.current),
          },
        ];
  });
}

/**
 * Whether `menu` shows an item linking to a section of a page (5.10, GA10): a section item, or a
 * link or button to a page's anchor, not hidden, in a dropdown or not. The export then includes the
 * "section-spy" behaviour, which shows the section in view on the page it links into.
 */
export function menuLinksToSections(menu: MenuDoc | undefined): boolean {
  const linksIn = (item: MenuLeaf) =>
    !item.hidden &&
    item.kind !== "page" &&
    item.link.kind === "page" &&
    item.link.anchor !== undefined;
  return (menu?.items ?? []).some((item) =>
    item.kind === "group" ? !item.hidden && item.children.some(linksIn) : linksIn(item),
  );
}

/**
 * Whether the export includes the "section-spy" behaviour (5.10, GA10): `menu` links to a section
 * ({@link menuLinksToSections}), and the Header, among the site's `header` nodes, hasn't turned
 * *Highlight the section in view* off (5.10b, GA10-1). A site from before the option has it on.
 */
export function highlightsSectionInView(
  menu: MenuDoc | undefined,
  header: readonly NodeDoc[],
): boolean {
  return (
    menuLinksToSections(menu) &&
    !header.some((node) => node.type === "Header" && node.props.sectionHighlight === false)
  );
}
