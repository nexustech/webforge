import {
  anchorFrom,
  anchorsIn,
  isSharedCopy,
  type MenuItem,
  newId,
  type PageId,
  pageAnchors,
  pastedCopies,
  type SiteDoc,
} from "@webforge/model";
import { retargetLinks } from "./retarget-links.js";

/** The section a page starts with, which a one-page site keeps only once: its first. */
const HERO = "Hero";

/**
 * Makes `site`, a new site, a one-page site (GA10, 5.9): every page but the home page and "Page
 * not found" becomes sections at the end of the home page, in page order, the first of each named
 * after its page with an anchor (`our-menu`). Links to a page go to its section instead, the menu
 * becomes a section link for each (the template's buttons kept after them), and the Header stays
 * at the top when scrolling, so the menu is always at hand. Only the site's first Hero is kept:
 * each page's own would repeat it. The person deletes any other section they don't want.
 */
export function mergeIntoHome(site: SiteDoc): void {
  const home = site.pages[site.homePageId];
  if (home === undefined) return;
  const merged = site.pageOrder.filter(
    (id) => id !== site.homePageId && site.pages[id]?.kind === "page",
  );
  const shownInMenu = new Set(
    site.menu.items.flatMap((item) => (item.kind === "page" && !item.hidden ? [item.pageId] : [])),
  );
  const taken = pageAnchors(home.doc.content, site.sharedSections, site.layout);
  let hero = home.doc.content.some((node) => node.type === HERO);
  const targets = new Map<PageId, string | undefined>();
  // Each page's anchors that came along with its sections: a link to one of them still goes there.
  const moved = new Map<string, ReadonlySet<string>>();
  const sections: MenuItem[] = [];
  for (const id of merged) {
    const page = site.pages[id];
    if (page === undefined) continue;
    const kept = page.doc.content.filter((node) => {
      if (node.type !== HERO) return true;
      if (hero) return false;
      hero = true;
      return true;
    });
    // New ids: two pages of a template may use the same ones.
    const copies = pastedCopies(kept, taken);
    const anchors = anchorsIn(copies);
    for (const anchor of anchors) taken.add(anchor);
    moved.set(id, anchors);
    home.doc.content.push(...copies);
    // A linked copy of a shared section shows its section's anchor, not its own: name the first
    // section of the page's own instead.
    const first = copies.find((node) => !isSharedCopy(node));
    let anchor: string | undefined;
    if (first !== undefined) {
      const name = page.navLabel ?? page.title;
      anchor = first.props.advanced?.anchorId ?? anchorFrom(name, (each) => taken.has(each));
      first.props.advanced = { ...first.props.advanced, anchorId: anchor };
      taken.add(anchor);
      sections.push({
        id: newId("menuItem"),
        kind: "section",
        link: { kind: "page", pageId: home.id, anchor },
        label: name,
        hidden: !shownInMenu.has(id) || page.settings.hideFromNavigation,
      });
    }
    targets.set(id, anchor);
  }
  for (const id of merged) {
    delete site.pages[id];
    site.pageOrder.splice(site.pageOrder.indexOf(id), 1);
  }
  retargetLinks(site, targets, (pageId, anchor) => moved.get(pageId)?.has(anchor) === true);
  const homeItem = site.menu.items.find(
    (item) => item.kind === "page" && item.pageId === home.id,
  ) ?? { id: newId("menuItem"), kind: "page", pageId: home.id, hidden: false };
  site.menu = {
    follows: "custom",
    items: [homeItem, ...sections, ...site.menu.items.filter((item) => item.kind === "button")],
  };
  for (const node of site.layout.header) {
    if (node.type === "Header") node.props.sticky = true;
  }
}
