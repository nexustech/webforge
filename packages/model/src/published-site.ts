import type { PageId } from "./ids.js";
import type { PageEntry, SiteDoc } from "./site-doc.js";

/**
 * Whether `page` of `site` is a draft (G37, #864): marked so in Page Settings, and neither the
 * home page nor *Page not found*, which are always published whatever their settings say.
 */
export function isDraftPage(site: Pick<SiteDoc, "homePageId">, page: PageEntry): boolean {
  return page.settings.draft === true && page.kind === "page" && page.id !== site.homePageId;
}

/**
 * `site` as it is published (G37, #864): without its draft pages, which the export, a publish and
 * the preview leave out, with the pictures and documents only they use. Their menu items and the
 * links to them go too, as those to a page that isn't there do. `site` itself when it has none.
 */
export function publishedSite(site: SiteDoc): SiteDoc {
  const drafts = new Set<string>(
    Object.values(site.pages)
      .filter((page) => isDraftPage(site, page))
      .map((page) => page.id),
  );
  if (drafts.size === 0) return site;
  return {
    ...site,
    pages: Object.fromEntries(
      Object.entries(site.pages).filter(([id]) => !drafts.has(id)),
    ) as Record<PageId, PageEntry>,
    pageOrder: site.pageOrder.filter((id) => !drafts.has(id)),
  };
}
