import { describe, expect, it } from "vitest";
import type { PageId } from "./ids.js";
import { isDraftPage, publishedSite } from "./published-site.js";
import { createSite, type SiteDoc } from "./site-doc.js";

/** A site with a home page, *Page not found* and the pages `ids`, `drafts` of them drafts. */
function site(ids: readonly string[], drafts: readonly string[] = []): SiteDoc {
  const base = createSite({
    name: "Bakery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Not found",
  });
  const home = base.pages[base.homePageId];
  if (home === undefined) throw new Error("no home page");
  const pages = { ...base.pages };
  for (const id of ids) {
    pages[id as PageId] = {
      ...JSON.parse(JSON.stringify(home)),
      id: id as PageId,
      slug: id,
      title: id,
      settings: { ...home.settings, ...(drafts.includes(id) ? { draft: true } : {}) },
    };
  }
  return { ...base, pages, pageOrder: [...base.pageOrder, ...(ids as PageId[])] };
}

const about = "about" as PageId;

describe("publishedSite", () => {
  it("leaves out the draft pages, in order, and keeps the rest (G37)", () => {
    const doc = site(["about", "winter", "contact"], ["winter"]);

    const published = publishedSite(doc);

    expect(published.pageOrder).toEqual(doc.pageOrder.filter((id) => id !== "winter"));
    expect(Object.keys(published.pages).sort()).toEqual([...published.pageOrder].sort());
    expect(published.pages[about]).toBe(doc.pages[about]);
    // The menu still names it: the navigation leaves out an item whose page isn't built.
    expect(published.menu).toBe(doc.menu);
  });

  it("gives back the site itself when it has no drafts", () => {
    const doc = site(["about"]);

    expect(publishedSite(doc)).toBe(doc);
  });

  it("always publishes the home page and Page not found, whatever their settings say", () => {
    const doc = site(["about"]);
    for (const page of Object.values(doc.pages)) page.settings.draft = true;

    const published = publishedSite(doc);

    expect(Object.values(published.pages).map((page) => page.kind)).toEqual(
      expect.arrayContaining(["page", "not-found"]),
    );
    expect(published.pages[doc.homePageId]).toBeDefined();
    expect(published.pages[about]).toBeUndefined();
    const home = doc.pages[doc.homePageId];
    if (home === undefined) throw new Error("no home page");
    expect(isDraftPage(doc, home)).toBe(false);
  });
});
