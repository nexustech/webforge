import type { PageId, SiteDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { findIn, siteWith } from "../test-site.test-helper.js";
import {
  deviceNamesRule,
  emptyPagesRule,
  homePageRule,
  pageTitlesRule,
  webAddressRule,
} from "./pages.js";

const ABOUT = "page-about" as PageId;

/** A site with an About page at `slug` in `folder`, titled `title`. */
function withAbout(slug: string, folder?: string, title = "About") {
  const site = siteWith();
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  return {
    ...site,
    pages: {
      ...site.pages,
      [ABOUT]: { ...home, id: ABOUT, slug, title, ...(folder === undefined ? {} : { folder }) },
    },
    pageOrder: [...site.pageOrder, ABOUT],
  };
}

describe("device names (R16)", () => {
  it("finds a page or a folder named after a Windows device, in any case", () => {
    expect(findIn(deviceNamesRule, withAbout("con"))).toEqual([
      {
        key: ABOUT,
        place: { kind: "page", pageId: ABOUT },
        values: { page: "About", path: "con" },
      },
    ]);
    expect(findIn(deviceNamesRule, withAbout("hours", "shop/lpt1"))).toHaveLength(1);
    expect(findIn(deviceNamesRule, withAbout("console"))).toEqual([]);
  });

  it("leaves the home page and the 'Page not found' page alone: they're index and 404", () => {
    const site = siteWith();
    const home = site.pages[site.homePageId];
    if (home === undefined) throw new Error("no home page");
    const named = {
      ...site,
      pages: { ...site.pages, [site.homePageId]: { ...home, slug: "aux" } },
    };

    expect(findIn(deviceNamesRule, named)).toEqual([]);
  });
});

describe("home page", () => {
  it("passes for a site whose home page is a page", () => {
    expect(findIn(homePageRule, siteWith())).toEqual([]);
  });

  it("fails when the home page is missing or is the 'Page not found' page", () => {
    const site = siteWith();
    const notFound = site.pageOrder.find((id) => site.pages[id]?.kind === "not-found");
    if (notFound === undefined) throw new Error("no 'Page not found' page");

    expect(findIn(homePageRule, { ...site, homePageId: notFound })).toHaveLength(1);
    expect(findIn(homePageRule, { ...site, homePageId: "page-gone" as PageId })).toEqual([
      { key: "home", place: { kind: "page", pageId: "page-gone" } },
    ]);
  });
});

describe("page titles", () => {
  it("finds pages without a title, spaces only included", () => {
    expect(findIn(pageTitlesRule, withAbout("about", undefined, "  "))).toEqual([
      { key: ABOUT, place: { kind: "page", pageId: ABOUT } },
    ]);
    expect(findIn(pageTitlesRule, withAbout("about"))).toEqual([]);
    expect(pageTitlesRule.strictOnPublish).toBe(true);
  });
});

describe("web address", () => {
  it("asks for the web address until Site Settings has one", () => {
    const site = siteWith();
    expect(findIn(webAddressRule, site)).toEqual([{ key: "address", place: { kind: "address" } }]);
    const withAddress = {
      ...site,
      settings: { ...site.settings, address: { url: "https://rosas.example" } },
    };
    expect(findIn(webAddressRule, withAddress)).toEqual([]);
    expect(webAddressRule.strictOnPublish).toBe(true);
  });
});

describe("empty pages (#1171)", () => {
  /** `withAbout`'s site, with the About page's content `content`. */
  function aboutWith(content: unknown[], extra: Record<string, unknown> = {}): SiteDoc {
    const site: SiteDoc = withAbout("about");
    const about = site.pages[ABOUT];
    if (about === undefined) throw new Error("no About page");
    return {
      ...site,
      pages: {
        ...site.pages,
        [ABOUT]: { ...about, ...extra, doc: { ...about.doc, content } },
      },
    } as SiteDoc;
  }
  // The test site's Home and "Page not found" pages have no sections either: About's finding only.
  const found = (site: SiteDoc) =>
    findIn(emptyPagesRule, site).filter((finding) => finding.key === ABOUT);
  const section = (hidden?: boolean) => ({
    type: "Section",
    props: { id: "s1", ...(hidden === undefined ? {} : { hidden }) },
  });

  it("finds a page with no sections, by its title", () => {
    expect(found(aboutWith([]))).toEqual([
      { key: ABOUT, place: { kind: "page", pageId: ABOUT }, values: { page: "About" } },
    ]);
    expect(emptyPagesRule.level).toBe("should");
  });

  it("finds one whose only sections are hidden, which the export leaves out", () => {
    expect(found(aboutWith([section(true)]))).toHaveLength(1);
    expect(found(aboutWith([section(true), section()]))).toEqual([]);
  });

  it("leaves a page with a section alone, and a draft page, which isn't exported", () => {
    expect(found(aboutWith([section()]))).toEqual([]);
    expect(found(aboutWith([], { settings: { draft: true } }))).toEqual([]);
  });
});
