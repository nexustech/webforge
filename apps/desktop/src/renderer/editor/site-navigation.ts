import { mediaItem, pagePath, type SiteDoc } from "@webforge/model";
import type { NavItem, NavLink } from "@webforge/site-components";
// The export's own navigation, through a subpath that must stay free of Node imports, as it runs
// in the renderer (the pipeline-navigation-no-node rule in .dependency-cruiser.mjs checks it).
import { type NavigationPage, navigationFor, pageLinksFor } from "@webforge/site-components";

/** The site's pages as the navigation sees them, in Pages panel order, as the export has them. */
function navigationPages(site: SiteDoc): NavigationPage[] {
  return site.pageOrder.flatMap((id) => {
    const page = site.pages[id];
    return page === undefined
      ? []
      : [
          {
            id: page.id,
            path: pagePath(page, site.homePageId),
            title: page.title,
            navLabel: page.navLabel,
            // A Blog's post is in the menu only where an edited menu has it (6.10a): a menu that
            // follows the pages leaves posts out (syncMenuWithPages).
            hideFromNavigation: page.settings.hideFromNavigation || page.kind === "not-found",
            ...(page.kind === "not-found"
              ? { kind: "not-found" as const }
              : page.collection === undefined
                ? {}
                : { kind: "post" as const }),
          },
        ];
  });
}

/** A link on the canvas goes nowhere: following it would load another document into the canvas. */
const inert = ({ newTab: _newTab, download: _download, ...link }: NavLink): NavLink => ({
  ...link,
  href: "#",
});

/**
 * The site's navigation as the canvas shows it on page `pageId` (F-ED-17): made as the export makes
 * it, that page the current one, its links inert. None for a page the site doesn't have.
 */
export function canvasNavigation(site: SiteDoc, pageId: string): readonly NavItem[] | undefined {
  const pages = navigationPages(site);
  const page = pages.find((candidate) => candidate.id === pageId);
  if (page === undefined) return undefined;
  // A link to a document shows while the document is in Media; its address is inert here.
  const inMedia = (id: string) => (mediaItem(site.media, id)?.kind === "file" ? id : undefined);
  // A menu item to a Blog's list goes nowhere on the canvas, as every link does (#940).
  const collections = Object.values(site.collections);
  return navigationFor(
    { pages, menu: site.menu, collections },
    page,
    "",
    () => undefined,
    inMedia,
  ).map(
    (item): NavItem =>
      "children" in item ? { ...item, children: item.children.map(inert) } : inert(item),
  );
}

/**
 * A link to each of the site's pages on page `pageId`, as the canvas shows them (HF-8): what a
 * Footer's Menu links can add, made as the export makes them, their addresses inert. None for a
 * page the site doesn't have.
 */
export function canvasPageLinks(site: SiteDoc, pageId: string): readonly NavLink[] | undefined {
  const pages = navigationPages(site);
  const page = pages.find((candidate) => candidate.id === pageId);
  return page === undefined ? undefined : pageLinksFor({ pages }, page, "").map(inert);
}
