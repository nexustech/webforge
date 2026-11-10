import { describe, expect, it } from "vitest";
import { newId, type PageId } from "./ids.js";
import {
  keepingOldAddresses,
  keptAddressesOf,
  keptAddressWorks,
  pageFile,
  tidyKeptAddresses,
} from "./kept-addresses.js";
import { deletePageFrom, insertPage, renamePageIn } from "./pages.js";
import { KEPT_ADDRESSES_MAX, keptAddressFileSchema, siteSettingsSchema } from "./settings.js";
import { createSite, type SiteDoc, siteDocSchema } from "./site-doc.js";

/** A site with an About us page (`about-us.html`) and a Team page in `company/`. */
function site(): { site: SiteDoc; about: PageId; team: PageId } {
  const made = createSite({
    name: "Rosa's",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Not found",
  });
  const about = newId("page");
  const team = newId("page");
  insertPage(made, about, "About us");
  insertPage(made, team, "Team");
  const teamPage = made.pages[team];
  if (teamPage !== undefined) teamPage.folder = "company";
  return { site: made, about, team };
}

describe("old addresses kept working (#862, SEO-5)", () => {
  it("keeps a renamed page's old address, aimed at the page", () => {
    const { site: draft, about } = site();

    keepingOldAddresses(draft, () => renamePageIn(draft, about, "About"));

    expect(pageFile(draft, about)).toBe("about.html");
    expect(keptAddressesOf(draft)).toEqual([{ from: "about-us.html", page: about }]);
    expect(siteDocSchema.parse(draft)).toEqual(draft);
  });

  it("sends each of a page's old addresses straight to where it is now, never in a chain", () => {
    const { site: draft, about } = site();

    keepingOldAddresses(draft, () => renamePageIn(draft, about, "About"));
    keepingOldAddresses(draft, () => renamePageIn(draft, about, "Our story"));

    expect(keptAddressesOf(draft)).toEqual([
      { from: "about-us.html", page: about },
      { from: "about.html", page: about },
    ]);
  });

  it("stops keeping an address a page has again, renamed back or new", () => {
    const { site: draft, about } = site();
    keepingOldAddresses(draft, () => renamePageIn(draft, about, "About"));

    keepingOldAddresses(draft, () => renamePageIn(draft, about, "About us"));
    expect(keptAddressesOf(draft)).toEqual([{ from: "about.html", page: about }]);

    insertPage(draft, newId("page"), "About");
    tidyKeptAddresses(draft);
    expect(draft.settings.search).not.toHaveProperty("keptAddresses");
  });

  it("keeps a page's address from before a folder move, and from before it was the Home page", () => {
    const { site: draft, about, team } = site();

    keepingOldAddresses(draft, () => {
      const page = draft.pages[team];
      if (page !== undefined) delete page.folder;
    });
    keepingOldAddresses(draft, () => {
      draft.homePageId = about;
    });

    expect(keptAddressesOf(draft)).toEqual([
      { from: "company/team.html", page: team },
      { from: "about-us.html", page: about },
    ]);
    // The old Home page's index.html now belongs to the new one: it isn't kept.
  });

  it("drops a deleted page's old addresses, and keeps nothing for 'Page not found'", () => {
    const { site: draft, about } = site();
    keepingOldAddresses(draft, () => renamePageIn(draft, about, "About"));

    deletePageFrom(draft, about);
    tidyKeptAddresses(draft);
    expect(keptAddressesOf(draft)).toEqual([]);

    const notFound = draft.pageOrder.find((id) => draft.pages[id]?.kind === "not-found") as PageId;
    expect(keptAddressWorks(draft, { from: "missing.html", page: notFound })).toBe(false);
  });

  it("keeps the later of two entries for one address, and only the most recent past the limit", () => {
    const { site: draft, about, team } = site();
    draft.settings.search.keptAddresses = [
      { from: "old.html", page: about },
      { from: "old.html", page: team },
    ];
    tidyKeptAddresses(draft);
    expect(keptAddressesOf(draft)).toEqual([{ from: "old.html", page: team }]);

    draft.settings.search.keptAddresses = Array.from({ length: KEPT_ADDRESSES_MAX }, (_, at) => ({
      from: `old-${at}.html`,
      page: team,
    }));
    keepingOldAddresses(draft, () => renamePageIn(draft, about, "About"));
    expect(keptAddressesOf(draft)).toHaveLength(KEPT_ADDRESSES_MAX);
    expect(keptAddressesOf(draft).at(0)?.from).toBe("old-1.html");
    expect(keptAddressesOf(draft).at(-1)).toEqual({ from: "about-us.html", page: about });
  });

  it("takes addresses typed from an older website, up to three levels, ending in .html", () => {
    for (const file of ["about-us.html", "Services/Old_Page.html", "a/b/c.html"]) {
      expect(keptAddressFileSchema.safeParse(file).success, file).toBe(true);
    }
    for (const file of [
      "about",
      "/about.html",
      "a/b/c/d.html",
      "../x.html",
      "a//b.html",
      "é.html",
      "con.html",
      "aux/old.html",
    ]) {
      expect(keptAddressFileSchema.safeParse(file).success, file).toBe(false);
    }
    const { site: settings } = site();
    expect(siteSettingsSchema.safeParse(settings.settings).success).toBe(true);
  });
});
