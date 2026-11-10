import { keptAddressesOf, type PageId, siteDocSchema, siteToSnapshot } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { sessionWith } from "../testing/fixtures.js";
import {
  addPage,
  changePageSettings,
  deletePage,
  moveToFolder,
  renameMovesPage,
  renamePage,
  setHomePage,
} from "./page-actions.js";

/** A session with an About us page (`about-us.html`). */
function setUp() {
  const session = sessionWith();
  const site = () => session.history.document.getState();
  const about = addPage(session, "About us") as PageId;
  const labels = () => session.history.entries().map((entry) => entry.label);
  return { session, site, about, labels };
}

describe("keeping a page's old address working (#862, SEO-5)", () => {
  it("renames a page and keeps its old address in one undo step", () => {
    const { session, site, about, labels } = setUp();

    renamePage(session, about, "About", true);

    expect(site().pages[about]?.slug).toBe("about");
    expect(keptAddressesOf(site())).toEqual([{ from: "about-us.html", page: about }]);
    expect(labels().at(-1)).toBe("Renamed page 'About'");
    expect(siteDocSchema.parse(site())).toEqual(site());
    // The export sends the old address on to the page.
    expect(siteToSnapshot(site(), new Map()).redirects).toEqual([
      { from: "about-us.html", to: "about" },
    ]);

    session.history.undo();
    expect(site().pages[about]?.slug).toBe("about-us");
    expect(site().settings.search).not.toHaveProperty("keptAddresses");
  });

  it("keeps nothing when asked not to, and frees an address the page has again", () => {
    const { session, site, about } = setUp();

    renamePage(session, about, "About", false);
    expect(site().settings.search).not.toHaveProperty("keptAddresses");

    renamePage(session, about, "Our story", true);
    renamePage(session, about, "About", false);
    expect(site().settings.search).not.toHaveProperty("keptAddresses");
  });

  it("keeps the old address of a page moved to a folder, made Home or given a new file name", () => {
    const { session, site, about } = setUp();
    const team = addPage(session, "Team") as PageId;

    moveToFolder(session, team, "Company", true);
    const page = site().pages[about];
    if (page === undefined) throw new Error("no page");
    changePageSettings(
      session,
      about,
      {
        title: page.title,
        slug: "who-we-are",
        description: "",
        shareImage: undefined,
        hideHeader: false,
        hideFooter: false,
        hideFromNavigation: false,
        hideBackToTop: false,
      },
      true,
    );
    setHomePage(session, team, true);

    expect(keptAddressesOf(site())).toEqual([
      { from: "team.html", page: team },
      { from: "about-us.html", page: about },
      { from: "company/team.html", page: team },
    ]);
  });

  it("drops a page's old addresses when it's deleted, and gives an address to a new page there", () => {
    const { session, site, about } = setUp();
    renamePage(session, about, "About", true);

    addPage(session, "About us");
    expect(site().settings.search).not.toHaveProperty("keptAddresses");

    renamePage(session, about, "Our story", true);
    deletePage(session, about);
    expect(site().settings.search).not.toHaveProperty("keptAddresses");
    session.history.undo();
    expect(keptAddressesOf(site())).toEqual([{ from: "about.html", page: about }]);
  });

  it("asks on rename only when the page's file name would change", () => {
    const { session, site, about } = setUp();

    expect(renameMovesPage(site(), about, "About")).toBe(true);
    expect(renameMovesPage(site(), about, "About us")).toBe(false);
    expect(renameMovesPage(site(), about, " ")).toBe(false);
    // The Home page is always index.html.
    expect(renameMovesPage(site(), site().homePageId, "Welcome")).toBe(false);

    // A file name set by hand stays when the page is renamed.
    const page = site().pages[about];
    if (page === undefined) throw new Error("no page");
    changePageSettings(session, about, {
      title: page.title,
      slug: "story",
      description: "",
      shareImage: undefined,
      hideHeader: false,
      hideFooter: false,
      hideFromNavigation: false,
      hideBackToTop: false,
    });
    expect(renameMovesPage(site(), about, "Something else")).toBe(false);
  });
});
