import type { Finish } from "@webforge/history";
import type { PageId, SiteDoc } from "@webforge/model";

/** Today on this computer, as the site format writes a day: `2026-10-28`. */
export function localDay(at = new Date()): string {
  const two = (value: number) => String(value).padStart(2, "0");
  return `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}`;
}

/**
 * Dates each page a change changed (3.15, SEO-3): its own doc, settings, title or file name, in
 * the same step, so undo takes the date back with the change. Site-wide changes (the theme, the
 * Header and Footer, shared sections) are no page's own, so they date none. The sitemap's
 * `lastmod` is this date.
 */
export function datePages(today: () => string): Finish<SiteDoc> {
  return (draft, changes) => {
    const changed = new Set<string>();
    for (const { path } of changes) {
      const [root, id, field] = path;
      if (root === "pages" && typeof id === "string" && field !== "updated") changed.add(id);
    }
    if (changed.size === 0) return;
    const day = today();
    for (const id of changed) {
      const page = draft.pages[id as PageId];
      if (page !== undefined && page.updated !== day) page.updated = day;
    }
  };
}
