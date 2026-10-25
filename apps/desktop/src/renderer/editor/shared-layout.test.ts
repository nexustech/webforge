import type { LayoutDoc, PageId, SiteDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { pagesShowing, sharedRegionOf, shownLayout, updateSharedField } from "./shared-layout.js";

/** The starter site, with its home page's settings changed by `settings`. */
function siteHiding(settings: { hideHeader?: boolean; hideFooter?: boolean }): SiteDoc {
  const site = starterSite();
  const home = site.pages[site.homePageId];
  if (home !== undefined) Object.assign(home.settings, settings);
  return site;
}

const layout: LayoutDoc = {
  header: [
    {
      type: "Section",
      props: { id: "header", content: [{ type: "Heading", props: { id: "logo", text: "Hi" } }] },
    },
  ],
  footer: [{ type: "Footer", props: { id: "footer", text: "Bye" } }],
};

describe("shownLayout", () => {
  it("is the site's layout where the page hides nothing", () => {
    const site = starterSite();

    expect(shownLayout(site, site.homePageId)).toBe(site.layout);
  });

  it("leaves out what the page hides, as the same object each time", () => {
    const site = siteHiding({ hideFooter: true });
    const shown = shownLayout(site, site.homePageId);

    expect(shown).toEqual({ header: site.layout.header, footer: [] });
    expect(shownLayout(site, site.homePageId)).toBe(shown);
    const bare = siteHiding({ hideHeader: true, hideFooter: true });
    expect(shownLayout(bare, bare.homePageId)).toEqual({ header: [], footer: [] });
  });

  it("shows everything for a page that isn't there", () => {
    const site = starterSite();

    expect(shownLayout(site, "page-gone" as PageId)).toBe(site.layout);
  });
});

describe("sharedRegionOf", () => {
  it("finds the region of a shared element, at any depth", () => {
    expect(sharedRegionOf(layout, "header")).toBe("header");
    expect(sharedRegionOf(layout, "logo")).toBe("header");
    expect(sharedRegionOf(layout, "footer")).toBe("footer");
    expect(sharedRegionOf(layout, "heading-1")).toBeUndefined();
  });
});

describe("pagesShowing", () => {
  it("counts the pages that don't hide the region", () => {
    const site = siteHiding({ hideHeader: true });
    const pages = Object.keys(site.pages).length;

    expect(pagesShowing(site, "header")).toBe(pages - 1);
    expect(pagesShowing(site, "footer")).toBe(pages);
  });
});

describe("updateSharedField", () => {
  it("sets a field of a shared element, at any depth", () => {
    const draft = structuredClone(layout);

    expect(updateSharedField(draft, layout, "header", "logo", "text", () => "Hello")).toBe(true);
    expect(updateSharedField(draft, layout, "footer", "logo", "text", () => "No")).toBe(false);
    expect(draft.header[0]?.props.content).toEqual([
      { type: "Heading", props: { id: "logo", text: "Hello" } },
    ]);
    expect(draft.footer).toEqual(layout.footer);
  });
});
