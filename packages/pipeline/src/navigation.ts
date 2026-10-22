import type { MenuDoc, MenuLeaf, SitePage } from "@webforge/model";
import type { NavItem, NavLink } from "@webforge/site-components";
import { hrefFor } from "./links.js";

/** What the navigation needs of a page: where it is, its names and whether it is hidden. */
export type NavigationPage = Pick<
  SitePage,
  "id" | "path" | "title" | "navLabel" | "hideFromNavigation"
>;

/** What the navigation needs of a site: its pages, in order, and its menu. */
export type NavigationSite = {
  readonly pages: readonly NavigationPage[];
  readonly menu?: MenuDoc | undefined;
};

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
    const href = hrefFor(item.link, (id) => pages.get(id)?.path, prefix, pathOfFile);
    if (href === undefined) {
      const { link } = item;
      broken(link.kind === "page" ? link.pageId : link.kind === "file" ? link.mediaId : link.kind);
      return undefined;
    }
    const link = item.link;
    const current =
      link.kind === "page" &&
      link.anchor === undefined &&
      pages.get(link.pageId)?.path === page.path;
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
