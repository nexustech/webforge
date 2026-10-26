import type { PageId } from "./ids.js";
import { syncMenuWithPages } from "./menu-sync.js";
import { PAGE_TITLE_MAX, type SiteDoc } from "./site-doc.js";
import { slugify, uniqueSlug } from "./slugs.js";

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
