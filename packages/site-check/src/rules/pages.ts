import { isDeviceName, pagePath } from "@webforge/model";
import type { CheckRule } from "../types.js";

/**
 * A page or folder named after a Windows device (`con`, `aux`, `nul`, `prn`, `com1`–`9`,
 * `lpt1`–`9`), whose file Windows can't write (R16): the export refuses it, so it's *Must fix*.
 * New pages and folders never get such a name; one comes from an older file. Its *Fix* renames it.
 */
export const deviceNamesRule: CheckRule = {
  id: "deviceNames",
  level: "must",
  check: ({ site }) =>
    site.pageOrder.flatMap((id) => {
      const page = site.pages[id];
      if (page === undefined) return [];
      const path = pagePath(page, site.homePageId);
      return path.split("/").some(isDeviceName)
        ? [{ key: id, place: { kind: "page", pageId: id }, values: { page: page.title, path } }]
        : [];
    }),
};

/**
 * The site has a home page (X5): what `index.html` is written from. A site file is refused without
 * one, so this only fails for a site whose home page is a "Page not found" page.
 */
export const homePageRule: CheckRule = {
  id: "homePage",
  level: "must",
  check: ({ site }) =>
    site.pages[site.homePageId]?.kind === "page"
      ? []
      : [{ key: "home", place: { kind: "page", pageId: site.homePageId } }],
};

/**
 * Every page has a title (X5): the browser tab and search results show it. *Must fix* to publish;
 * the *Fix* takes it from the page's first heading.
 */
export const pageTitlesRule: CheckRule = {
  id: "pageTitles",
  level: "should",
  strictOnPublish: true,
  check: ({ site }) =>
    site.pageOrder.flatMap((id) =>
      site.pages[id]?.title.trim() === ""
        ? [{ key: id, place: { kind: "page", pageId: id } as const }]
        : [],
    ),
};

/**
 * The site's web address is in Site Settings (X3, X5): without it the export writes no sitemap,
 * no canonical links, no share pictures in link previews and no structured data. In *Being found*
 * (3.17). *Must fix* to publish.
 */
export const webAddressRule: CheckRule = {
  id: "webAddress",
  level: "should",
  strictOnPublish: true,
  group: "found",
  check: ({ site }) =>
    (site.settings.address.url ?? "") === ""
      ? [{ key: "address", place: { kind: "address" } }]
      : [],
};
