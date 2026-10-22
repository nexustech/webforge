import {
  type MediaId,
  type MenuItemId,
  type NodeDoc,
  type PageEntry,
  type PageId,
  SHARED_COPY_TYPE,
  type SharedSectionId,
  type SiteDoc,
} from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import { starterSite } from "../editor/starter-site.js";
import { mediaUsage } from "./media-usage.js";

const hero = (id: string, mediaId: string, more: Record<string, unknown> = {}): NodeDoc => ({
  type: "Hero",
  props: { id, title: "Fresh bread", image: { mediaId }, ...more },
});

/** The starter site plus pages "about" and "shop", each with `content`. */
function siteWith(pages: Record<string, NodeDoc[]>): SiteDoc {
  const site = starterSite();
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  for (const [slug, content] of Object.entries(pages)) {
    const id = `page-${slug}` as PageId;
    const page: PageEntry = {
      ...structuredClone(home),
      id,
      slug,
      title: slug,
      doc: { root: { props: {} }, content },
    };
    site.pages[id] = page;
    site.pageOrder.push(id);
  }
  return site;
}

describe("mediaUsage", () => {
  it("counts each page that places an image once, hidden elements and slots included", () => {
    const site = siteWith({
      about: [hero("a", "shop"), hero("b", "shop")],
      shop: [
        {
          type: "Section",
          props: { id: "s", content: [hero("c", "shop", { hidden: true }), hero("d", "cakes")] },
        },
      ],
    });

    const usage = mediaUsage(site, siteLibrary);

    expect(usage.get("shop")).toBe(2);
    expect(usage.get("cakes")).toBe(1);
    expect(usage.get("unused")).toBeUndefined();
  });

  it("counts a Header or Footer image on every page that shows it, and share images", () => {
    const site = siteWith({ about: [], shop: [] });
    site.layout.footer = [hero("f", "logo")];
    const shop = site.pages["page-shop" as PageId];
    const about = site.pages["page-about" as PageId];
    if (shop === undefined || about === undefined) throw new Error("missing pages");
    shop.settings.hideFooter = true;
    about.settings.shareImage = "cakes" as MediaId;

    const usage = mediaUsage(site, siteLibrary);

    // The home page, the "Page not found" page and "about"; "shop" hides the Footer.
    expect(usage.get("logo")).toBe(site.pageOrder.length - 1);
    expect(usage.get("cakes")).toBe(1);
  });

  it("counts the site icon, the site's share image and files the menu links to on every page", () => {
    const site = siteWith({ about: [] });
    site.settings.general.icon = "icon" as MediaId;
    site.settings.social.shareImage = "share" as MediaId;
    site.menu.items.push({
      id: "group" as MenuItemId,
      kind: "group",
      hidden: false,
      label: "More",
      children: [
        {
          id: "prices" as MenuItemId,
          kind: "link",
          hidden: true,
          label: "Prices",
          link: { kind: "file", mediaId: "prices" as MediaId },
        },
      ],
    });

    const usage = mediaUsage(site, siteLibrary);

    for (const id of ["icon", "share", "prices"]) {
      expect(usage.get(id)).toBe(site.pageOrder.length);
    }
  });

  it("ignores values that aren't image placements", () => {
    const site = siteWith({
      about: [
        { type: "Hero", props: { id: "x", title: "shop", image: "shop" } },
        { type: "Unknown", props: { id: "u", image: { mediaId: "shop" } } },
      ],
    });

    expect(mediaUsage(site, siteLibrary).get("shop")).toBeUndefined();
  });

  it("counts each page that links to a document in a link field or rich text (1.28)", () => {
    const site = siteWith({
      about: [
        { type: "Hero", props: { id: "a", buttonLink: { kind: "file", mediaId: "prices" } } },
      ],
      menu: [
        { type: "Text", props: { id: "t", text: '<p><a href="webforge:file/prices">x</a></p>' } },
      ],
      shop: [
        { type: "Hero", props: { id: "b", buttonLink: { kind: "url", href: "https://a.b" } } },
      ],
    });

    expect(mediaUsage(site, siteLibrary).get("prices")).toBe(2);
  });

  it("counts a shared section's image and document on each page with a copy of it (F-ED-23)", () => {
    const copy = (id: string): NodeDoc => ({
      type: SHARED_COPY_TYPE,
      props: { id, sharedSectionId: "hours" as SharedSectionId },
    });
    const site = siteWith({ about: [copy("c1")], shop: [copy("c2")] });
    site.sharedSections = {
      ["hours" as SharedSectionId]: {
        id: "hours" as SharedSectionId,
        name: "Opening hours",
        section: hero("hours-hero", "shop-photo", {
          buttonLink: { kind: "file", mediaId: "timetable" },
        }),
      },
    };

    const usage = mediaUsage(site, siteLibrary);

    expect(usage.get("shop-photo")).toBe(2);
    expect(usage.get("timetable")).toBe(2);
  });
});
