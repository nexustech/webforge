import { t } from "@webforge/i18n";
import { exportedAddress, type SiteRedirect, type SiteSnapshot } from "@webforge/model";
import { escapeHtml } from "./html.js";
import { pageTitle, siteAddress } from "./site-files.js";

// Old addresses kept working (#862, SEO-5, G7). At each, the export writes a small page that sends
// visitors and search engines on to the page: a 0-second refresh, which Google takes as a
// permanent redirect, and a canonical address when the site has a web address. Netlify, and
// Cloudflare Pages, read `_redirects` too, and answer the old address with a real 301.

/**
 * The page at `redirect`'s old file: it moves on at once to the page, relative to where it is so
 * it works from disk and on any host, and says where in the site's language for a browser that
 * doesn't move on.
 */
export function redirectPage(site: SiteSnapshot, redirect: SiteRedirect): string {
  const page = site.pages.find((each) => each.path === redirect.to);
  const title = page === undefined ? site.name : pageTitle(site, page);
  const href = `${"../".repeat(redirect.from.split("/").length - 1)}${redirect.to}.html`;
  const address = siteAddress(site);
  return [
    "<!doctype html>",
    `<html lang="${escapeHtml(site.language)}">`,
    "<head>",
    '<meta charset="utf-8">',
    `<title>${escapeHtml(title)}</title>`,
    `<meta http-equiv="refresh" content="0; url=${escapeHtml(href)}">`,
    ...(address === undefined
      ? []
      : [`<link rel="canonical" href="${escapeHtml(exportedAddress(address, redirect.to))}">`]),
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "</head>",
    "<body>",
    `<p>${escapeHtml(t("siteText.redirect.moved"))} <a href="${escapeHtml(href)}">${escapeHtml(title)}</a></p>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

/** A page's address on its host, from the site's root: `/about.html`, the home page `/`. */
const hostPath = (path: string) => (path === "index" ? "/" : `/${path}.html`);

/**
 * `_redirects` for Netlify (and Cloudflare Pages): each old address, with and without `.html` as
 * Netlify serves pages both ways, moved for good to its page. `301!` because the export's page
 * is at the old address too, which a plain rule would leave answering.
 */
export function redirectsFile(redirects: readonly SiteRedirect[]): string {
  return `${redirects
    .flatMap(({ from, to }) => {
      const old = `/${from}`;
      return [
        `${old} ${hostPath(to)} 301!`,
        `${old.slice(0, -".html".length)} ${hostPath(to)} 301!`,
      ];
    })
    .join("\n")}\n`;
}

/** The files `site`'s old addresses need: a page at each, and `_redirects`. None without any. */
export function redirectFiles(site: SiteSnapshot): [string, string][] {
  const redirects = site.redirects ?? [];
  if (redirects.length === 0) return [];
  return [
    ...redirects.map((redirect): [string, string] => [redirect.from, redirectPage(site, redirect)]),
    ["_redirects", redirectsFile(redirects)],
  ];
}
