import { z } from "zod";
import {
  type LayoutDoc,
  layoutDocSchema,
  type PageDoc,
  pageDocSchema,
  siteCodeSchema,
  themeSchema,
} from "./documents.js";
import { mediaIdSchema, newId, type PageId, pageIdSchema } from "./ids.js";
import { mediaMetaSchema } from "./media.js";
import { type MenuItem, menuDocSchema } from "./menu.js";
import { defaultSiteSettings, siteSettingsSchema } from "./settings.js";

/** The format of {@link SiteDoc} this build writes. Bumped with a migration and a fixture. */
export const SITE_FORMAT_VERSION = 2;

const SEGMENT = "[a-z0-9]+(?:-[a-z0-9]+)*";

/**
 * A page's file name without `.html` (X1): lowercase ASCII letters, digits and single hyphens,
 * e.g. `about` or `opening-times`.
 */
export const slugSchema = z
  .string()
  .max(80)
  .regex(new RegExp(`^${SEGMENT}$`));

/** A folder for pages, e.g. `services` or `services/cakes`. */
export const folderSchema = z
  .string()
  .max(200)
  .regex(new RegExp(`^${SEGMENT}(?:/${SEGMENT})*$`));

/**
 * Slugs ordinary pages can't use: the home page is always `index.html`, the "Page not found" page
 * `404.html`, and `assets/` holds images, styles and scripts.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set(["index", "404", "assets"]);

/** Page Settings (F-SET-2). Title and slug live on the page entry itself. */
const pageSettingsSchema = z.strictObject({
  /** Meta description; the site's description when absent (X3). */
  description: z.string().max(300).optional(),
  /** `og:image`; the site's share image when absent. */
  shareImage: mediaIdSchema.optional(),
  hideHeader: z.boolean(),
  hideFooter: z.boolean(),
  hideFromNavigation: z.boolean(),
});

/** See {@link pageSettingsSchema}. */
export type PageSettings = z.infer<typeof pageSettingsSchema>;

/**
 * One page of the site. `kind: "not-found"` is the special "Page not found" page (F-ED-20): it is
 * designed like any page, exported as `404.html`, can't be deleted and is never in navigation.
 */
export const pageEntrySchema = z.strictObject({
  id: pageIdSchema,
  kind: z.enum(["page", "not-found"]),
  slug: slugSchema,
  folder: folderSchema.optional(),
  /** Shown in the browser tab and search results. */
  title: z.string().max(200),
  /** Shown in the navigation menu instead of the title, when set (decision S5). */
  navLabel: z.string().min(1).max(100).optional(),
  settings: pageSettingsSchema,
  doc: pageDocSchema,
});

/** See {@link pageEntrySchema}. */
export type PageEntry = z.infer<typeof pageEntrySchema>;

/** Where a page is exported, without `.html`: `index`, `404`, `about` or `services/cakes`. */
export function pagePath(page: PageEntry, homePageId: PageId): string {
  if (page.id === homePageId) {
    return "index";
  }
  if (page.kind === "not-found") {
    return "404";
  }
  return page.folder === undefined ? page.slug : `${page.folder}/${page.slug}`;
}

function menuItemIds(items: readonly MenuItem[]): string[] {
  return items.flatMap((item) => [
    item.id,
    ...(item.kind === "group" ? item.children.map((child) => child.id) : []),
  ]);
}

function duplicatesOf(values: readonly string[]): string[] {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
}

/**
 * The whole site as the editor holds it (architecture §5): one document per concern, stored as
 * separate `.wforge` documents so a save writes only what changed. Pages are keyed by id and
 * ordered by `pageOrder`, which is also the navigation order until the menu is edited (S6).
 */
export const siteDocSchema = z
  .strictObject({
    formatVersion: z.literal(SITE_FORMAT_VERSION),
    settings: siteSettingsSchema,
    theme: themeSchema,
    layout: layoutDocSchema,
    pages: z.record(pageIdSchema, pageEntrySchema),
    /** Every page id exactly once, in Pages panel order. */
    pageOrder: z.array(pageIdSchema),
    /** The page exported as `index.html`. */
    homePageId: pageIdSchema,
    media: z.record(mediaIdSchema, mediaMetaSchema),
    code: siteCodeSchema,
    menu: menuDocSchema,
  })
  .superRefine((site, ctx) => {
    const issue = (message: string, path: PropertyKey[]) =>
      ctx.addIssue({ code: "custom", message, path });
    const pages = Object.entries(site.pages);

    for (const [key, page] of pages) {
      if (page.id !== key) {
        issue(`Page "${key}" has the id "${page.id}"`, ["pages", key, "id"]);
      }
      if (page.kind === "page" && page.id !== site.homePageId && RESERVED_SLUGS.has(page.slug)) {
        issue(`The slug "${page.slug}" is reserved`, ["pages", key, "slug"]);
      }
      if (page.folder?.split("/")[0] === "assets") {
        issue("The folder 'assets' is reserved", ["pages", key, "folder"]);
      }
      if ((page.id === site.homePageId || page.kind === "not-found") && page.folder !== undefined) {
        issue("The home page and the 'Page not found' page can't be in a folder", [
          "pages",
          key,
          "folder",
        ]);
      }
    }

    const order = [...site.pageOrder].sort();
    const keys = pages.map(([key]) => key).sort();
    if (order.length !== keys.length || order.some((id, index) => id !== keys[index])) {
      issue("pageOrder must list every page exactly once", ["pageOrder"]);
    }

    const home = site.pages[site.homePageId];
    if (home === undefined || home.kind !== "page") {
      issue("The home page is missing", ["homePageId"]);
    }
    if (pages.filter(([, page]) => page.kind === "not-found").length !== 1) {
      issue("The site needs exactly one 'Page not found' page", ["pages"]);
    }

    const paths = duplicatesOf(pages.map(([, page]) => pagePath(page, site.homePageId)));
    if (paths.length > 0) {
      issue(`Duplicate page paths: ${paths.join(", ")}`, ["pages"]);
    }

    const media = Object.entries(site.media);
    for (const [key, item] of media) {
      if (item.id !== key) {
        issue(`Media "${key}" has the id "${item.id}"`, ["media", key, "id"]);
      }
    }
    // Exported files are named after the media name, so two items can't share one.
    const names = duplicatesOf(media.map(([, item]) => item.name));
    if (names.length > 0) {
      issue(`Duplicate media names: ${names.join(", ")}`, ["media"]);
    }

    const menuIds = duplicatesOf(menuItemIds(site.menu.items));
    if (menuIds.length > 0) {
      issue(`Duplicate menu item ids: ${menuIds.join(", ")}`, ["menu", "items"]);
    }
  });

/** See {@link siteDocSchema}. */
export type SiteDoc = z.infer<typeof siteDocSchema>;

/** Options of {@link createSite}. Titles come from the caller, translated. */
export type CreateSiteOptions = {
  readonly name: string;
  readonly language: string;
  readonly homeTitle: string;
  readonly notFoundTitle: string;
  readonly homeDoc?: PageDoc;
  readonly notFoundDoc?: PageDoc;
  readonly layout?: LayoutDoc;
  readonly theme?: string;
};

const emptyPage = (): PageDoc => ({ root: { props: {} }, content: [] });

const visiblePageSettings = (): PageSettings => ({
  hideHeader: false,
  hideFooter: false,
  hideFromNavigation: false,
});

/** A new site: a home page and a "Page not found" page, the menu following the pages. */
export function createSite(options: CreateSiteOptions): SiteDoc {
  const homeId = newId("page");
  const notFoundId = newId("page");
  return {
    formatVersion: SITE_FORMAT_VERSION,
    settings: defaultSiteSettings(options.name, options.language),
    theme: { name: options.theme ?? "light" },
    layout: options.layout ?? { header: [], footer: [] },
    pages: {
      [homeId]: {
        id: homeId,
        kind: "page",
        slug: "home",
        title: options.homeTitle,
        settings: visiblePageSettings(),
        doc: options.homeDoc ?? emptyPage(),
      },
      [notFoundId]: {
        id: notFoundId,
        kind: "not-found",
        slug: "page-not-found",
        title: options.notFoundTitle,
        settings: { ...visiblePageSettings(), hideFromNavigation: true },
        doc: options.notFoundDoc ?? emptyPage(),
      },
    },
    pageOrder: [homeId, notFoundId],
    homePageId: homeId,
    media: {},
    code: { css: "", js: "", head: "", bodyEnd: "" },
    menu: {
      follows: "pages",
      items: [{ id: newId("menuItem"), kind: "page", pageId: homeId, hidden: false }],
    },
  };
}
