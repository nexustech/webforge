import { entriesOf } from "./records.js";
import type { PageEntry, SiteDoc } from "./site-doc.js";

/**
 * Whether `page` of `site` is a draft (G37, #864): marked so in Page Settings, and neither the
 * home page nor *Page not found*, which are always published whatever their settings say.
 */
export function isDraftPage(site: Pick<SiteDoc, "homePageId">, page: PageEntry): boolean {
  return page.settings.draft === true && page.kind === "page" && page.id !== site.homePageId;
}

/**
 * `site` as it is published (G37, #864): without its draft pages, which the export and a publish
 * leave out, with the pictures and documents only they use. Their menu items and the
 * links to them go too, as those to a page that isn't there do. `site` itself when it has none.
 */
export function publishedSite(site: SiteDoc): SiteDoc {
  const drafts = new Set<string>(
    Object.values(site.pages)
      .filter((page) => isDraftPage(site, page))
      .map((page) => page.id),
  );
  if (drafts.size === 0) return site;
  const pages: SiteDoc["pages"] = {};
  for (const [id, page] of entriesOf(site.pages)) if (!drafts.has(id)) pages[id] = page;
  return {
    ...site,
    pages,
    pageOrder: site.pageOrder.filter((id) => !drafts.has(id)),
  };
}

/**
 * `site` as Preview shows it (G37, #864): its draft pages kept, so each can be checked in a browser
 * at its address, but left out of the navigation, as the menu is published. `site` itself when it
 * has none.
 */
export function previewedSite(site: SiteDoc): SiteDoc {
  const drafts = Object.values(site.pages).filter((page) => isDraftPage(site, page));
  if (drafts.length === 0) return site;
  const pages = { ...site.pages };
  for (const page of drafts) {
    pages[page.id] = { ...page, settings: { ...page.settings, hideFromNavigation: true } };
  }
  return { ...site, pages };
}
