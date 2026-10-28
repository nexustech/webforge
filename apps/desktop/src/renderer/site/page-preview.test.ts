import { type MediaId, type PageEntry, type PageId, siteToSnapshot } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { type PreviewValues, pagePreview } from "./page-preview.js";

const CAKES = "cakes" as PageId;

/** A bakery's site with a Cakes page in the Menu folder. */
function bakery() {
  const site = starterSite({ name: "Rosa's Bakery" });
  site.pages[CAKES] = {
    id: CAKES,
    kind: "page",
    slug: "cakes",
    folder: "menu",
    title: "Cakes",
    settings: { hideHeader: false, hideFooter: false, hideFromNavigation: false },
    doc: { root: { props: {} }, content: [] },
  };
  site.pageOrder = [...site.pageOrder, CAKES];
  site.settings.general.description = "Fresh bread in Hightown";
  return site;
}

/** Page Settings' values for `page`, as it opens. */
const valuesOf = (page: PageEntry): PreviewValues => ({
  title: page.title,
  slug: page.slug,
  description: page.settings.description ?? "",
  shareImage: page.settings.shareImage,
  hideFromSearch: page.settings.hideFromSearch === true,
});

describe("pagePreview (3.16, SEO-6)", () => {
  it("shows what the export writes: the title, the page's address and its description", () => {
    const site = bakery();
    site.settings.address = { url: "https://rosasbakery.co.uk/" };
    const page = site.pages[CAKES];
    if (page === undefined) throw new Error("no page");
    page.settings.description = "Birthday and wedding cakes";

    const preview = pagePreview(site, page, valuesOf(page));
    const exported = siteToSnapshot(site, new Map()).pages.find((each) => each.id === CAKES);

    expect(preview).toMatchObject({
      title: "Cakes | Rosa's Bakery",
      address: "https://rosasbakery.co.uk/menu/cakes.html",
      host: "rosasbakery.co.uk",
      description: exported?.description,
      inherited: false,
      hidden: undefined,
    });
  });

  it("shows the site's description, said as such, for a page without one, and the file without a web address", () => {
    const site = bakery();
    const page = site.pages[CAKES];
    if (page === undefined) throw new Error("no page");

    const preview = pagePreview(site, page, valuesOf(page));

    expect(preview).toMatchObject({
      address: "menu/cakes.html",
      host: undefined,
      description: "Fresh bread in Hightown",
      inherited: true,
    });
    // The site's name alone on the home page.
    const home = site.pages[site.homePageId];
    if (home === undefined) throw new Error("no home page");
    expect(pagePreview(site, home, valuesOf(home)).title).toBe("Rosa's Bakery");
  });

  it("follows the values as typed: a new title, file name and description", () => {
    const site = bakery();
    const page = site.pages[CAKES];
    if (page === undefined) throw new Error("no page");

    const preview = pagePreview(site, page, {
      ...valuesOf(page),
      title: "Our cakes",
      slug: "Our Cakes!",
      description: "  Made to order  ",
    });

    expect(preview).toMatchObject({
      title: "Our cakes | Rosa's Bakery",
      address: "menu/our-cakes.html",
      description: "Made to order",
      inherited: false,
    });
  });

  it("keeps the saved title while the title field is empty, as saving does", () => {
    const site = bakery();
    const page = site.pages[CAKES];
    if (page === undefined) throw new Error("no page");

    expect(pagePreview(site, page, { ...valuesOf(page), title: "  " }).title).toBe(
      "Cakes | Rosa's Bakery",
    );
  });

  it("says why a page isn't in search results instead of drawing one", () => {
    const site = bakery();
    const page = site.pages[CAKES];
    if (page === undefined) throw new Error("no page");
    const notFound = Object.values(site.pages).find((each) => each.kind === "not-found");
    if (notFound === undefined) throw new Error("no 'Page not found'");

    expect(pagePreview(site, page, { ...valuesOf(page), hideFromSearch: true }).hidden).toBe(
      "page",
    );
    expect(pagePreview(site, notFound, valuesOf(notFound)).hidden).toBe("not-found");
    site.settings.search.allowIndexing = false;
    expect(pagePreview(site, page, valuesOf(page)).hidden).toBe("site");
  });

  it("shows the page's share picture, or the site's when it has none", () => {
    const site = bakery();
    const image = (id: string) => ({
      id: id as MediaId,
      kind: "image" as const,
      hash: id.repeat(64).slice(0, 64),
      name: id,
      fileName: `${id}.jpg`,
      mimeType: "image/jpeg" as const,
      width: 1200,
      height: 630,
      alt: "",
    });
    site.media["a" as MediaId] = image("a");
    site.media["b" as MediaId] = image("b");
    site.settings.social.shareImage = "a" as MediaId;
    const page = site.pages[CAKES];
    if (page === undefined) throw new Error("no page");
    const url = (item: { readonly id: string }) => `thumb:${item.id}`;

    expect(pagePreview(site, page, valuesOf(page), url).image).toBe("thumb:a");
    expect(
      pagePreview(site, page, { ...valuesOf(page), shareImage: "b" as MediaId }, url).image,
    ).toBe("thumb:b");
  });
});
