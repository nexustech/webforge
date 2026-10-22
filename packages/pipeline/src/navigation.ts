import type { MenuLeaf, SitePage, SiteSnapshot } from "@webforge/model";
import type { NavItem, NavLink } from "@webforge/site-components";
import { hrefFor } from "./links.js";

/**
 * The navigation the Header shows on `page` (F-ED-17), with URLs relative to it (`prefix` is its
 * `../` per folder). It comes from the site's menu: a page item shows its page's navigation label
 * or title unless it has a name of its own; links, sections and buttons go where their link goes;
 * dropdowns hold their items. An item is left out when it is hidden in the menu, or its page is
 * hidden from navigation in Page Settings ("Page not found" always is), as is a dropdown left
 * empty. A link that goes nowhere (its page deleted) is left out too and reported through
 * `broken`. Without a menu, the navigation lists the pages in order.
 */
export function navigationFor(
  site: SiteSnapshot,
  page: SitePage,
  prefix: string,
  broken: (detail: string) => void,
): NavItem[] {
  const shown = (other: SitePage) => other.hideFromNavigation !== true;
  const pageLink = (other: SitePage, label?: string): NavLink => ({
    label: label ?? other.navLabel ?? other.title,
    href: `${prefix}${other.path}.html`,
    current: other.path === page.path,
  });
  if (site.menu === undefined) {
    return site.pages.filter(shown).map((other) => pageLink(other));
  }

  const pages = new Map(site.pages.map((other) => [other.id as string, other]));
  const leaf = (item: MenuLeaf): NavLink | undefined => {
    if (item.hidden) return undefined;
    if (item.kind === "page") {
      const target = pages.get(item.pageId);
      return target === undefined || !shown(target) ? undefined : pageLink(target, item.label);
    }
    const href = hrefFor(item.link, (id) => pages.get(id)?.path, prefix);
    if (href === undefined) {
      broken(item.link.kind === "page" ? item.link.pageId : item.link.kind);
      return undefined;
    }
    const link = item.link;
    const current =
      link.kind === "page" && link.anchor === undefined && pages.get(link.pageId) === page;
    return {
      label: item.label,
      href,
      current,
      ...(item.kind === "button" ? { button: true } : {}),
      ...(link.newTab === true ? { newTab: true } : {}),
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
      : [{ label: item.label, children, current: children.some((child) => child.current) }];
  });
}
