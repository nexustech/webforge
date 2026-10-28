import { webAddressSchema } from "./settings.js";

/**
 * How the export names a page to search engines and when it's shared (3.3, 3.5), kept in one place
 * so Page Settings' preview (3.16) shows exactly what the export writes.
 */

/**
 * A page's title in its `<title>` and `og:title`: the site's name alone on the home page (`index`),
 * otherwise *Page | Site name*.
 */
export function exportedTitle(siteName: string, path: string, title: string): string {
  return path === "index" ? siteName : `${title} | ${siteName}`;
}

/**
 * `address` as the export writes it into pages (X3): Site Settings' web address without a slash at
 * its end, if it is one Site Settings would accept; nothing otherwise.
 */
export function exportedSiteAddress(address: string | undefined): string | undefined {
  const url = webAddressSchema.safeParse(address);
  return url.success ? url.data.replace(/\/+$/, "") : undefined;
}

/**
 * A page's address under the site's, as its canonical link and `og:url` have it: the home page is
 * the address itself (`…/`), any other page its file (`…/services/cakes.html`).
 */
export function exportedAddress(address: string, path: string): string {
  return path === "index" ? `${address}/` : `${address}/${path}.html`;
}
