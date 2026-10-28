import { z } from "zod";
import {
  type LayoutDoc,
  layoutDocSchema,
  type PageDoc,
  pageDocSchema,
  siteCodeSchema,
  themeSchema,
  withoutUnsafeKeys,
} from "./documents.js";
import { mediaIdSchema, newId, type PageId, pageIdSchema } from "./ids.js";
import { mediaMetaSchema } from "./media.js";
import { MENU_LABEL_MAX, type MenuItem, menuDocSchema } from "./menu.js";
import { defaultSiteSettings, siteSettingsSchema } from "./settings.js";
import { containsCopy, copyIssues, sharedSectionsDocSchema } from "./shared-sections.js";
import { copyTheme, DEFAULT_THEME, type ThemeTokens } from "./theme.js";

/** The format of {@link SiteDoc} this build writes. Bumped with a migration and a fixture. */
export const SITE_FORMAT_VERSION = 9;

const SEGMENT = "[a-z0-9]+(?:-[a-z0-9]+)*";

/** The longest file name a page can have, without `.html`. */
export const PAGE_SLUG_MAX = 80;
/** The longest folder path a page can be in, e.g. `services/cakes`. */
export const PAGE_FOLDER_MAX = 200;
/** The longest title a page can have (the browser tab, search results). */
export const PAGE_TITLE_MAX = 200;
/** The longest description a page or the site can have for search results (X3). */
export const PAGE_DESCRIPTION_MAX = 300;

/**
 * A page's file name without `.html` (X1): lowercase ASCII letters, digits and single hyphens,
 * e.g. `about` or `opening-times`.
 */
export const slugSchema = z
  .string()
  .max(PAGE_SLUG_MAX)
  .regex(new RegExp(`^${SEGMENT}$`));

/** A folder for pages, e.g. `services` or `services/cakes`. */
export const folderSchema = z
  .string()
  .max(PAGE_FOLDER_MAX)
  .regex(new RegExp(`^${SEGMENT}(?:/${SEGMENT})*$`));

/**
 * Slugs ordinary pages can't use: the home page is always `index.html`, the "Page not found" page
 * `404.html`, and `assets/` holds images, styles and scripts.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set(["index", "404", "assets"]);

/** Page Settings (F-SET-2). Title and slug live on the page entry itself. */
const pageSettingsSchema = z.strictObject({
  /** Meta description; the site's description when absent (X3). */
  description: z.string().max(PAGE_DESCRIPTION_MAX).optional(),
  /** `og:image`; the site's share image when absent. */
  shareImage: mediaIdSchema.optional(),
  hideHeader: z.boolean(),
  hideFooter: z.boolean(),
  hideFromNavigation: z.boolean(),
  /**
   * Leaves the site's back-to-top button off this page (F-CM-9, 2.9). Shown, if the site has it,
   * when absent, as in files from before it.
   */
  hideBackToTop: z.boolean().optional(),
  /**
   * *Hide this page from search engines* (3.15, SEO-2): `noindex` on it, and left out of the
   * sitemap, `llms.txt` and the Markdown copies; still linked. Shown when absent, as before
   * (ADR 0012).
   */
  hideFromSearch: z.boolean().optional(),
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
  title: z.string().max(PAGE_TITLE_MAX),
  /** Shown in the navigation menu instead of the title, when set (decision S5). */
  navLabel: z.string().min(1).max(MENU_LABEL_MAX).optional(),
  settings: pageSettingsSchema,
  doc: pageDocSchema,
  /**
   * The day the page itself last changed (3.15, SEO-3), `2026-10-28`: set by every edit to it,
   * not by site-wide ones (the theme, Header and Footer, shared sections), and undone with it. The
   * sitemap's `lastmod`. Absent until it first changes (ADR 0012: absent leaves `lastmod` out).
   */
  updated: z.iso.date().optional(),
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
 * The schema of each part of a site but its pages, which is also the document each is stored as.
 * The `site` document's three fields are checked one by one, in {@link SITE_FIELD_SCHEMAS}.
 */
export const SITE_PART_SCHEMAS = {
  settings: siteSettingsSchema,
  theme: themeSchema,
  layout: layoutDocSchema,
  media: z.record(mediaIdSchema, mediaMetaSchema),
  code: siteCodeSchema,
  menu: menuDocSchema,
  /** Shared sections (F-ED-23): saved once, placed on pages as linked copies. */
  sharedSections: sharedSectionsDocSchema,
} as const;

/** The fields of the `site` document: the format and the pages' order, which concern every page. */
export const SITE_FIELD_SCHEMAS = {
  formatVersion: z.literal(SITE_FORMAT_VERSION),
  /** Every page id exactly once, in Pages panel order. */
  pageOrder: z.array(pageIdSchema),
  /** The page exported as `index.html`. */
  homePageId: pageIdSchema,
} as const;

/** One of {@link siteIssues}: what is wrong, and where in the site. */
type SiteIssue = { readonly message: string; readonly path: PropertyKey[] };

/**
 * Which parts of a site {@link siteIssues} walks the element trees of, looking for misplaced copies
 * of shared sections: every page and the layout, or only those a change touched. The rest of its
 * checks are cheap and always cover the whole site.
 */
type SiteIssueScope = {
  readonly pages: "all" | ReadonlySet<string>;
  readonly layout: boolean;
};

/** Every page and the layout: what checking a whole site covers. */
const WHOLE_SITE: SiteIssueScope = { pages: "all", layout: true };

/**
 * What is wrong across the parts of a site that each part's schema can't see: pages keyed by their
 * id, reserved slugs and folders, one home page and one "Page not found" page, the page order,
 * unique page paths, media names and menu ids, and copies of shared sections only at the top of
 * pages. `scope` limits the tree walks to the pages and layout that changed (R13a); the site's
 * other parts must have passed before.
 */
export function siteIssues(site: SiteDoc, scope: SiteIssueScope = WHOLE_SITE): SiteIssue[] {
  const issues: SiteIssue[] = [];
  const issue = (message: string, path: PropertyKey[]) => issues.push({ message, path });
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
    if (scope.pages === "all" || scope.pages.has(key)) {
      for (const { message, path } of copyIssues(page.doc.content)) {
        issue(message, ["pages", key, "doc", "content", ...path]);
      }
    }
  }

  // Copies of shared sections go on pages, never in the Header or Footer (F-ED-23).
  if (scope.layout) {
    for (const region of ["header", "footer"] as const) {
      if (containsCopy(site.layout[region])) {
        issue("The Header and Footer can't hold a copy of a shared section", ["layout", region]);
      }
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
  return issues;
}

/**
 * The whole site as the editor holds it (architecture §5): one document per concern, stored as
 * separate `.wforge` documents so a save writes only what changed. Pages are keyed by id and
 * ordered by `pageOrder`, which is also the navigation order until the menu is edited (S6).
 */
const siteDocObjectSchema = z
  .strictObject({
    // In the order sites have always been parsed in, which is the order of their keys.
    formatVersion: SITE_FIELD_SCHEMAS.formatVersion,
    settings: SITE_PART_SCHEMAS.settings,
    theme: SITE_PART_SCHEMAS.theme,
    layout: SITE_PART_SCHEMAS.layout,
    pages: z.record(pageIdSchema, pageEntrySchema),
    pageOrder: SITE_FIELD_SCHEMAS.pageOrder,
    homePageId: SITE_FIELD_SCHEMAS.homePageId,
    media: SITE_PART_SCHEMAS.media,
    code: SITE_PART_SCHEMAS.code,
    menu: SITE_PART_SCHEMAS.menu,
    sharedSections: SITE_PART_SCHEMAS.sharedSections,
  })
  .superRefine((site, ctx) => {
    for (const { message, path } of siteIssues(site)) {
      ctx.addIssue({ code: "custom", message, path });
    }
  });

/**
 * The site document. Every part of it (settings, media, menu, code, not only the pages' element
 * trees) is refused if it holds a `__proto__`, `constructor` or `prototype` key (#138).
 */
export const siteDocSchema = withoutUnsafeKeys(siteDocObjectSchema);

/** See {@link siteDocSchema}. */
export type SiteDoc = z.infer<typeof siteDocObjectSchema>;

/** Options of {@link createSite}. Titles come from the caller, translated. */
export type CreateSiteOptions = {
  readonly name: string;
  readonly language: string;
  readonly homeTitle: string;
  readonly notFoundTitle: string;
  readonly homeDoc?: PageDoc;
  readonly notFoundDoc?: PageDoc;
  readonly layout?: LayoutDoc;
  /** The theme to start from; the default theme if left out. */
  readonly theme?: ThemeTokens;
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
    theme: copyTheme(options.theme ?? DEFAULT_THEME),
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
    sharedSections: {},
  };
}
