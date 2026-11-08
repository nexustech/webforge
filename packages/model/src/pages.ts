import { findBrokenLinks } from "./broken-links.js";
import type { PageId } from "./ids.js";
import { syncMenuWithPages } from "./menu-sync.js";
import { PAGE_TITLE_MAX, type PageEntry, type SiteDoc } from "./site-doc.js";
import { slugify, uniqueSlug } from "./slugs.js";

/**
 * The ids of a site's `pages`. Object keys are plain strings to TypeScript; these are the record's
 * own, so they are page ids (R10).
 */
export const pageIdsOf = (pages: SiteDoc["pages"]): PageId[] => Object.keys(pages) as PageId[];

/**
 * Whether `id` is one of `pages`, as a page id: never a property every object has, such as
 * `constructor`, for an id read from a place, a link or an AI app's command.
 */
export const isPageIn = (pages: SiteDoc["pages"], id: string): id is PageId =>
  Object.hasOwn(pages, id);

/** Page `id` of `pages`, if it has one (see {@link isPageIn}). */
export const pageEntryOf = (pages: SiteDoc["pages"], id: string): PageEntry | undefined =>
  isPageIn(pages, id) ? pages[id] : undefined;

/** A name as a page title: trimmed, and short enough to save. */
export const pageTitle = (name: string): string => name.trim().slice(0, PAGE_TITLE_MAX).trim();

/** Slugs other pages already use in `folder` (undefined for the top level). */
export function slugsInFolder(
  site: SiteDoc,
  folder: string | undefined,
  except?: PageId,
): Set<string> {
  return new Set(
    Object.values(site.pages)
      .filter((page) => page.folder === folder && page.id !== except)
      .map((page) => page.slug),
  );
}

/** A free slug for a page named `name` in `folder`, `except` the page being renamed or moved. */
export function pageSlugFor(
  site: SiteDoc,
  name: string,
  folder: string | undefined,
  except?: PageId,
): string {
  return uniqueSlug(slugify(name), slugsInFolder(site, folder, except));
}

/**
 * Adds an empty page `id` called `title` to `draft` (an undo step's), as the Pages panel and AI
 * apps add one (F-ED-13, 4.8): its slug follows the title and is free at the top level, it goes at
 * the end but before a "Page not found" page that is last, and the menu takes it in if it follows
 * the pages.
 */
export function insertPage(draft: SiteDoc, id: PageId, title: string): void {
  draft.pages[id] = {
    id,
    kind: "page",
    slug: pageSlugFor(draft, title, undefined),
    title,
    settings: { hideHeader: false, hideFooter: false, hideFromNavigation: false },
    doc: { root: { props: {} }, content: [] },
  };
  const last = draft.pageOrder.at(-1);
  const beforeNotFound = last !== undefined && draft.pages[last]?.kind === "not-found";
  draft.pageOrder.splice(beforeNotFound ? -1 : draft.pageOrder.length, 0, id);
  draft.menu = syncMenuWithPages(draft, id);
}

/**
 * The page actions the Pages panel and AI apps share (F-ED-13, 4.11): what each may do, and the
 * change to the site it makes, in an undo step's draft. The panel and the command layer each make
 * the step and its label.
 */

/** Whether `page` can be deleted: not the Home page or the "Page not found" page. */
export const canDeletePage = (site: SiteDoc, page: PageEntry) =>
  page.kind === "page" && page.id !== site.homePageId;

/**
 * How many pages deleting `pageId` changes (D7): the page itself, and every page left with a link
 * to it, in its content or in what all pages share (the menu, the Header, the Footer).
 */
export function pagesChangedByDeleting(site: SiteDoc, pageId: PageId): number {
  const { [pageId]: _deleted, ...rest } = site.pages;
  const others = site.pageOrder.filter((id) => id !== pageId && site.pages[id] !== undefined);
  const linking = new Set(
    findBrokenLinks({ ...site, pages: rest })
      .filter((link) => "pageId" in link && link.pageId === pageId)
      .map((link) => link.on),
  );
  const shared = linking.has("menu") || linking.has("header") || linking.has("footer");
  return 1 + (shared ? others.length : others.filter((id) => linking.has(id)).length);
}

/** Deletes page `pageId` from `draft`, and from the menu if it follows the pages. */
export function deletePageFrom(draft: SiteDoc, pageId: PageId): void {
  delete draft.pages[pageId];
  const at = draft.pageOrder.indexOf(pageId);
  if (at !== -1) draft.pageOrder.splice(at, 1);
  draft.menu = syncMenuWithPages(draft);
}

/**
 * The slug a page gets when renamed to `title`: it follows the name (`About us` → `about-us`)
 * while it still matches the old name, and stays as it is once set by hand in Page Settings, so
 * a rename never breaks links to a file name the person chose.
 */
export function slugAfterRename(site: SiteDoc, page: PageEntry, title: string): string {
  const followsName = page.slug === pageSlugFor(site, page.title, page.folder, page.id);
  return followsName ? pageSlugFor(site, title, page.folder, page.id) : page.slug;
}

/** Renames page `pageId` in `draft` to `title`, its slug as {@link slugAfterRename} says. */
export function renamePageIn(draft: SiteDoc, pageId: PageId, title: string): void {
  const page = draft.pages[pageId];
  if (page === undefined) return;
  page.slug = slugAfterRename(draft, page, title);
  page.title = title;
}

/**
 * The page next to `pageId` in `direction` among the pages in the same folder, or undefined at
 * either end. The Pages panel shows each folder's pages together, so moves stay within one.
 */
export function pageNeighbour(
  site: SiteDoc,
  pageId: PageId,
  direction: -1 | 1,
): PageId | undefined {
  const folder = site.pages[pageId]?.folder;
  const siblings = site.pageOrder.filter((id) => site.pages[id]?.folder === folder);
  const at = siblings.indexOf(pageId);
  return at === -1 ? undefined : siblings[at + direction];
}

/** Swaps pages `pageId` and `other` in `draft`'s page order, and in the menu if it follows them. */
export function swapPages(draft: SiteDoc, pageId: PageId, other: PageId): void {
  const from = draft.pageOrder.indexOf(pageId);
  const to = draft.pageOrder.indexOf(other);
  if (from === -1 || to === -1) return;
  draft.pageOrder[from] = other;
  draft.pageOrder[to] = pageId;
  draft.menu = syncMenuWithPages(draft);
}
