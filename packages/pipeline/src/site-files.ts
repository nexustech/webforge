import {
  type SitePage,
  type SiteSnapshot,
  VERIFICATION_TAGS,
  webAddressSchema,
} from "@webforge/model";
import { escapeHtml, type SiteIcon } from "./html.js";

/** The "Page not found" page's path: its file is `404.html`, which hosts serve for missing pages. */
export const NOT_FOUND_PATH = "404";

/**
 * The site's web address (X3), without a slash at its end, if Site Settings have one. Only an
 * address Site Settings would accept, an `https` host and nothing more, as it's written into
 * pages' links as it is.
 */
export function siteAddress(site: SiteSnapshot): string | undefined {
  const url = webAddressSchema.safeParse(site.settings?.["address.url"]);
  return url.success ? url.data.replace(/\/+$/, "") : undefined;
}

/** A page's title, in its browser tab and when it's shared: the site's name for the home page. */
export function pageTitle(site: SiteSnapshot, page: SitePage): string {
  return page.path === "index" ? site.name : `${page.title} | ${site.name}`;
}

/** `page`'s address under the site's: the home page is the address itself (`…/`). */
export function pageAddress(address: string, path: string): string {
  return path === "index" ? `${address}/` : `${address}/${path}.html`;
}

/** The site's search settings, with what a snapshot without them means. */
export function searchOf(site: SiteSnapshot): NonNullable<SiteSnapshot["search"]> {
  return site.search ?? { allowIndexing: true, includeSitemap: true, readableByAi: false };
}

/** Whether `site` gets a sitemap: a web address, search engines allowed and the sitemap on. */
export function hasSitemap(site: SiteSnapshot): boolean {
  const search = searchOf(site);
  return siteAddress(site) !== undefined && search.allowIndexing && search.includeSitemap;
}

/** A `<meta>` with `name` or `property` `key` and `content`, escaped. */
const meta = (attribute: "name" | "property", key: string, content: string) =>
  `<meta ${attribute}="${key}" content="${escapeHtml(content)}">`;

/** Options of {@link shareTags}. */
type ShareOptions = {
  readonly site: SiteSnapshot;
  readonly page: SitePage;
  /** `../` per folder, or the site's root for the "Page not found" page. */
  readonly prefix: string;
  /** The page's share picture's file (3.4), if it has one. */
  readonly shareImage: string | undefined;
  /** Whether the site has the icon set, so pages link its manifest. */
  readonly manifest: boolean;
};

/**
 * The share and search tags of `page` (3.5), after the favicon set's links in its `<head>`:
 * - its canonical address, when the site has a web address (never the "Page not found" page's,
 *   which stands for every missing address);
 * - Open Graph and Twitter's tags: its title, description and share picture, absolute with a web
 *   address and relative to the page without one (social previews may show no picture then, which
 *   the export report says), and the site's X handle;
 * - `noindex` when search engines aren't allowed, on a page hidden from them (3.15, SEO-2), and on
 *   the "Page not found" page always;
 * - the verification codes Google's and Bing's consoles gave, on every page (3.15, SEO-8);
 * - the web app manifest, when the site has its icons.
 */
export function shareTags({ site, page, prefix, shareImage, manifest }: ShareOptions): string[] {
  const address = siteAddress(site);
  const search = searchOf(site);
  const notFound = page.path === NOT_FOUND_PATH;
  // Kept from search engines: no canonical address beside its noindex, which Google takes as
  // conflicting signals (3.15, SEO-2), as "Page not found" has none.
  const unlisted = notFound || page.hideFromSearch === true;
  const image =
    shareImage === undefined
      ? undefined
      : address === undefined
        ? `${prefix}${shareImage}`
        : `${address}/${shareImage}`;
  return [
    ...(address === undefined || unlisted
      ? []
      : [`<link rel="canonical" href="${escapeHtml(pageAddress(address, page.path))}">`]),
    ...(!search.allowIndexing || unlisted ? [meta("name", "robots", "noindex")] : []),
    ...(search.verification?.google === undefined
      ? []
      : [meta("name", VERIFICATION_TAGS.google, search.verification.google)]),
    ...(search.verification?.bing === undefined
      ? []
      : [meta("name", VERIFICATION_TAGS.bing, search.verification.bing)]),
    meta("property", "og:type", "website"),
    meta("property", "og:site_name", site.name),
    meta("property", "og:title", pageTitle(site, page)),
    ...(page.description === undefined
      ? []
      : [meta("property", "og:description", page.description)]),
    ...(address === undefined || unlisted
      ? []
      : [meta("property", "og:url", pageAddress(address, page.path))]),
    ...(image === undefined ? [] : [meta("property", "og:image", image)]),
    meta("name", "twitter:card", image === undefined ? "summary" : "summary_large_image"),
    ...(search.xHandle === undefined
      ? []
      : [
          meta(
            "name",
            "twitter:site",
            search.xHandle.startsWith("@") ? search.xHandle : `@${search.xHandle}`,
          ),
        ]),
    ...(manifest ? [`<link rel="manifest" href="${prefix}site.webmanifest">`] : []),
  ];
}

/**
 * The web app manifest (3.5), when the site has its icon set (3.4): its name, the PNG icons a
 * phone puts on its home screen, and where it starts. Readable JSON (X4).
 */
export function webManifest(site: SiteSnapshot, icons: readonly SiteIcon[]): string {
  return `${JSON.stringify(
    {
      name: site.name,
      short_name: site.name,
      start_url: "./",
      display: "browser",
      icons: icons
        .filter((icon) => icon.type === "image/png")
        .map((icon) => ({ src: icon.path, sizes: icon.sizes, type: icon.type })),
    },
    null,
    2,
  )}\n`;
}

/**
 * `robots.txt` (3.5): every page open to search engines, with the sitemap's address when there is
 * one. Crawling stays allowed when Site Settings keep the site out of search: its pages say
 * `noindex`, which a search engine only reads on a page it may fetch (3.15, SEO-3).
 */
export function robotsTxt(site: SiteSnapshot): string {
  const address = siteAddress(site);
  return [
    "User-agent: *",
    "Allow: /",
    ...(hasSitemap(site) && address !== undefined ? ["", `Sitemap: ${address}/sitemap.xml`] : []),
    "",
  ].join("\n");
}

/** Whether `page` is one search engines are told about: not "Page not found" nor hidden (SEO-2). */
const searchable = (page: SitePage) => page.path !== NOT_FOUND_PATH && page.hideFromSearch !== true;

/**
 * `sitemap.xml` (3.5): every page's address but the "Page not found" page's and those hidden from
 * search (3.15, SEO-2); pages hidden from the navigation are in it (they are on the site). Each
 * with the day it last changed, where that's known (`lastmod`, SEO-3). Only with a web address
 * ({@link hasSitemap}).
 */
export function sitemapXml(site: SiteSnapshot, address: string): string {
  const urls = site.pages
    .filter(searchable)
    .map((page) =>
      [
        "  <url>",
        `    <loc>${escapeHtml(pageAddress(address, page.path))}</loc>`,
        ...(page.updated === undefined ? [] : [`    <lastmod>${page.updated}</lastmod>`]),
        "  </url>",
      ].join("\n"),
    );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}

/** `{year}` in the site's text, as the year it's built in (F-CM-8): no script needed. */
export function withYear(html: string, year: number): string {
  // Not in scripts and styles: Custom Code's `${year}` in a template literal stays as written.
  return html.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>|\{year\}/gi, (match) =>
    match === "{year}" ? String(year) : match,
  );
}

/**
 * The pages AI tools get a Markdown copy of (F-EX-5): every page but "Page not found" and those
 * hidden from search (3.15, SEO-2).
 */
export function readablePages(site: SiteSnapshot): readonly SitePage[] {
  return site.pages.filter(searchable);
}

/** Stands for the site's root while a page's links are resolved; never written. */
const ROOT = "https://root.webforge.invalid";

/**
 * The address a page's Markdown copy gives a link or image that the page at `pagePath` has as
 * `href` (F-EX-5): under the web address, or from the site's root (`/about.html`) without one. A
 * link to another site, an email address or a phone number stays as it is.
 */
export function markdownUrl(site: SiteSnapshot, pagePath: string, href: string): string {
  const url = URL.parse(href, `${ROOT}/${pagePath}.html`);
  if (url?.origin !== ROOT) return href;
  return `${siteAddress(site) ?? ""}${url.pathname}${url.search}${url.hash}`;
}

/** A page's Markdown copy, with its title as its heading when its content has no title of its own. */
export function markdownPage(page: SitePage, content: string): string {
  return /^# /m.test(content) ? content : `# ${page.title}\n\n${content}`;
}

/**
 * `llms.txt` (F-EX-5, llmstxt.org): the site's name and description, and a list of its pages'
 * Markdown copies with their descriptions, pages hidden from the navigation too.
 */
export function llmsTxt(site: SiteSnapshot): string {
  const address = siteAddress(site) ?? "";
  const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();
  const description = searchOf(site).description;
  return [
    `# ${oneLine(site.name)}`,
    "",
    ...(description === undefined || description.trim() === ""
      ? []
      : [`> ${oneLine(description)}`, ""]),
    "## Pages",
    "",
    ...readablePages(site).map((page) => {
      const title = oneLine(page.title).replace(/[[\]\\]/g, "\\$&");
      const link = `- [${title}](${address}/${page.path}.md)`;
      return page.description === undefined || page.description.trim() === ""
        ? link
        : `${link}: ${oneLine(page.description)}`;
    }),
    "",
  ].join("\n");
}
