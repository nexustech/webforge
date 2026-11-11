import { t } from "@webforge/i18n";
import {
  exportedAddress,
  listPath,
  type NodeDoc,
  type SiteCollection,
  type SitePage,
  type SiteSnapshot,
} from "@webforge/model";
import { type ComponentLibrary, POSTS_PER_PAGE } from "@webforge/site-components";
import { escapeHtml } from "./html.js";
import { siteAddress } from "./site-files.js";

/**
 * The Blog's own pages and feed (6.10b, ADR 0025, decision 8), which the export writes from the
 * Blog's published posts: its list of posts, ten a page (`blog/index`, `blog/page/2`…), a page for
 * each tag (`blog/tag/news`), and `blog/feed.xml`. The pages are ordinary pages to the rest of the
 * build: the Header and Footer, a Latest posts section, links, the sitemap and `llms.txt` as for any
 * page. Their folders are the Blog's own, which no page of the site may be in (`siteIssues`).
 */

/** A Latest posts section listing `collection`'s posts as one of its own pages shows them. */
function listSection(
  library: ComponentLibrary,
  collection: SiteCollection,
  id: string,
  title: string,
  listing: { readonly page: number } | { readonly tag: string },
): NodeDoc {
  return {
    type: "LatestPosts",
    props: {
      ...structuredClone(library.components.LatestPosts?.defaults ?? {}),
      id,
      title,
      collection: collection.id,
      ...listing,
    } as NodeDoc["props"],
  };
}

/** A page of the site the export writes, `path`, titled `title`, its content `node`. */
const ownPage = (id: string, path: string, title: string, node: NodeDoc): SitePage => ({
  id,
  path,
  title,
  // Reached from the Blog's links, not the menu.
  hideFromNavigation: true,
  doc: { root: { props: {} }, content: [node] },
});

/** The pages `collection` gets: its list, page by page, then each tag's, in its posts' order. */
function pagesOf(collection: SiteCollection, library: ComponentLibrary): SitePage[] {
  const count = Math.max(1, Math.ceil(collection.items.length / POSTS_PER_PAGE));
  const lists = Array.from({ length: count }, (_, index) => {
    const page = index + 1;
    const title =
      page === 1
        ? collection.name
        : t("siteText.blogPage", { name: collection.name, page: String(page) });
    const id = `${collection.id}-list-${page}`;
    return ownPage(
      id,
      listPath(collection.folder, page),
      title,
      listSection(library, collection, id, collection.name, { page }),
    );
  });
  const tags = new Map<string, string>();
  for (const item of collection.items) {
    const value = item.values.tags;
    if (value?.kind !== "tags") continue;
    for (const tag of value.tags) if (!tags.has(tag.path)) tags.set(tag.path, tag.name);
  }
  const tagPages = [...tags].map(([path, name]) => {
    const title = t("siteText.postsTagged", { tag: name });
    const id = `${collection.id}-${path.split("/").at(-1) ?? "tag"}`;
    return ownPage(id, path, title, listSection(library, collection, id, title, { tag: path }));
  });
  return [...lists, ...tagPages];
}

/**
 * `site` with each collection's own pages after its pages, those it already has a page at left as
 * they are (`siteIssues` keeps pages out of their folders, so none should be).
 */
export function withBlogPages(site: SiteSnapshot, library: ComponentLibrary): SiteSnapshot {
  if (site.collections === undefined || site.collections.length === 0) return site;
  const paths = new Set(site.pages.map((page) => page.path));
  const own = site.collections
    .flatMap((collection) => pagesOf(collection, library))
    .filter((page) => !paths.has(page.path));
  return own.length === 0 ? site : { ...site, pages: [...site.pages, ...own] };
}

/** Where `collection`'s feed is: `blog/feed.xml`. */
export const feedPath = (collection: SiteCollection) => `${collection.folder}/feed.xml`;

/**
 * Each collection's RSS 2.0 feed (6.10b): its posts, newest first, each with its title, address,
 * day and summary. Only with a web address, which a feed's links need whole.
 */
export function feedFiles(site: SiteSnapshot): [string, string][] {
  const address = siteAddress(site);
  if (address === undefined) return [];
  return (site.collections ?? []).map((collection) => [
    feedPath(collection),
    feedXml(site, collection, address),
  ]);
}

/** `date`, `YYYY-MM-DD`, as RSS writes a day (RFC 822): `Tue, 10 Nov 2026 00:00:00 GMT`. */
const rssDate = (date: string) => new Date(`${date}T00:00:00Z`).toUTCString();

function feedXml(site: SiteSnapshot, collection: SiteCollection, address: string): string {
  const element = (name: string, text: string) => `<${name}>${escapeHtml(text)}</${name}>`;
  const items = collection.items.map((item) => {
    const { title, date, summary } = item.values;
    const link = exportedAddress(address, item.path);
    return [
      "    <item>",
      `      ${element("title", title?.kind === "text" ? title.text : "")}`,
      `      ${element("link", link)}`,
      `      <guid isPermaLink="true">${escapeHtml(link)}</guid>`,
      ...(date?.kind === "date" ? [`      ${element("pubDate", rssDate(date.date))}`] : []),
      ...(summary?.kind === "text" ? [`      ${element("description", summary.text)}`] : []),
      "    </item>",
    ].join("\n");
  });
  const description = site.search?.description ?? site.name;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    ${element("title", `${collection.name} | ${site.name}`)}`,
    `    ${element("link", exportedAddress(address, listPath(collection.folder)))}`,
    `    ${element("description", description)}`,
    `    ${element("language", site.language)}`,
    `    <atom:link href="${escapeHtml(`${address}/${feedPath(collection)}`)}" rel="self" type="application/rss+xml"/>`,
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}

/** The `<head>` links to the site's feeds, `prefix` away, for every page: none without them. */
export function feedLinks(site: SiteSnapshot, prefix: string): string[] {
  if (siteAddress(site) === undefined) return [];
  return (site.collections ?? []).map(
    (collection) =>
      `<link rel="alternate" type="application/rss+xml" title="${escapeHtml(collection.name)}" href="${escapeHtml(`${prefix}${feedPath(collection)}`)}">`,
  );
}
