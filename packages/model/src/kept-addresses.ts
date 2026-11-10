import type { PageId } from "./ids.js";
import { KEPT_ADDRESSES_MAX, type KeptAddress } from "./settings.js";
import { pagePath, type SiteDoc } from "./site-doc.js";

// Old addresses kept working (#862, SEO-5, G7). Each names the page it goes to, not that page's
// address then, so a page renamed twice sends both its old addresses straight to where it is now:
// never a chain of redirects.

/** The file a page is exported as: `about.html`, `services/plumbing.html`. */
export const pageFile = (site: SiteDoc, id: PageId): string | undefined => {
  const page = site.pages[id];
  return page === undefined ? undefined : `${pagePath(page, site.homePageId)}.html`;
};

/** Every page's file in `site`. */
export const pageFiles = (site: SiteDoc): Set<string> =>
  new Set(
    site.pageOrder.flatMap((id) => {
      const file = pageFile(site, id);
      return file === undefined ? [] : [file];
    }),
  );

/** The old addresses `site` keeps working: none when Site Settings have none. */
export const keptAddressesOf = (site: SiteDoc): readonly KeptAddress[] =>
  site.settings.search.keptAddresses ?? [];

/**
 * Whether `kept` still means something in `site`: its page is there and is an ordinary page, and no
 * page is at its old address, which the page there takes.
 */
export function keptAddressWorks(
  site: SiteDoc,
  kept: KeptAddress,
  files = pageFiles(site),
): boolean {
  const page = site.pages[kept.page];
  return page?.kind === "page" && !files.has(kept.from);
}

/**
 * Leaves out of `draft`'s Site Settings the old addresses that no longer mean anything: a page is
 * at the address again (a page renamed back, or a new page), its page was deleted or is "Page not
 * found", or another entry has the address already (the later one stays). None left is none at
 * all (ADR 0012).
 */
export function tidyKeptAddresses(draft: SiteDoc): void {
  const kept = draft.settings.search.keptAddresses;
  if (kept === undefined) return;
  const files = pageFiles(draft);
  const byFile = new Map<string, KeptAddress>();
  for (const entry of kept) {
    if (!keptAddressWorks(draft, entry, files)) continue;
    byFile.delete(entry.from);
    byFile.set(entry.from, entry);
  }
  const tidy = [...byFile.values()];
  if (tidy.length === kept.length && tidy.every((entry, at) => entry === kept[at])) return;
  if (tidy.length === 0) delete draft.settings.search.keptAddresses;
  else draft.settings.search.keptAddresses = tidy;
}

/**
 * Makes `change` to `draft` (an undo step's), keeping working the old address of each ordinary page
 * whose address it changes (#862): a rename, a new file name, a move to or from a folder, a new
 * Home page. Each is added to Site Settings' list, the most recent last, then the list is tidied
 * ({@link tidyKeptAddresses}), so an address a page has again is no longer kept. Past the list's
 * limit, the oldest entries go.
 */
export function keepingOldAddresses(draft: SiteDoc, change: () => void): void {
  const before = new Map(draft.pageOrder.map((id) => [id, pageFile(draft, id)]));
  change();
  const added: KeptAddress[] = [];
  for (const id of draft.pageOrder) {
    if (draft.pages[id]?.kind !== "page") continue;
    const was = before.get(id);
    if (was !== undefined && was !== pageFile(draft, id)) added.push({ from: was, page: id });
  }
  if (added.length > 0) {
    const kept = [...keptAddressesOf(draft), ...added];
    draft.settings.search.keptAddresses = kept.slice(-KEPT_ADDRESSES_MAX);
  }
  tidyKeptAddresses(draft);
}
