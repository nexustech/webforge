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

/** `text` as a regular expression matching it: an old address's `.` is all it needs escaping. */
const literal = (text: string) => text.replace(/[.\\^$|?*+()[\]{}]/g, "\\$&");

/**
 * The rules an Apache host's `.htaccess` needs to answer each old address with a real 301 (5.15,
 * CC-7), which publishing writes into the host's file as a marked block, never touching the rest
 * (`@webforge/publish`'s `withRedirectRules`). Each old address, with or without `.html`, in any
 * case, goes on to its page. `%1`, the folder the request reached the site's folder by, keeps the
 * rules right for a site in a folder of the host (`/shop/`), with no address to know;
 * `mod_rewrite` only, which the rules check for. The pages at the old addresses stay, for hosts
 * that ignore them and for the site opened from disk.
 */
export function htaccessRules(redirects: readonly SiteRedirect[]): string {
  return [
    "<IfModule mod_rewrite.c>",
    "RewriteEngine On",
    ...redirects.flatMap(({ from, to }) => {
      const old = `${literal(from.slice(0, -".html".length))}(\\.html)?`;
      const target = to === "index" ? "" : `${to}.html`;
      return [
        `RewriteCond %{REQUEST_URI} ^(.*/)${old}$ [NC]`,
        `RewriteRule ^${old}$ %1${target} [R=301,NC,L]`,
      ];
    }),
    "</IfModule>",
  ].join("\n");
}

/**
 * The old addresses `site`'s export writes: each but one at a file the export made already
 * (`taken`, the thank-you page it adds, 3.7), in any case, as Windows' and macOS's folders don't
 * tell `About.html` from `about.html`, and a rule would send the file's visitors away.
 */
export function writtenRedirects(site: SiteSnapshot, taken: Iterable<string> = []): SiteRedirect[] {
  const used = new Set([...taken].map((file) => file.toLowerCase()));
  return (site.redirects ?? []).filter((redirect) => {
    const file = redirect.from.toLowerCase();
    if (used.has(file)) return false;
    used.add(file);
    return true;
  });
}

/**
 * The files `site`'s old addresses need: a page at each, and `_redirects` with a rule for each page
 * written ({@link writtenRedirects}). None without any.
 */
export function redirectFiles(
  site: SiteSnapshot,
  taken: Iterable<string> = [],
): [string, string][] {
  const written = writtenRedirects(site, taken);
  if (written.length === 0) return [];
  return [
    ...written.map((redirect): [string, string] => [redirect.from, redirectPage(site, redirect)]),
    ["_redirects", redirectsFile(written)],
  ];
}
