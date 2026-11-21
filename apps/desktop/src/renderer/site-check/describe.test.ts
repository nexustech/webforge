import type { MediaId, PageId, SharedSectionId, SiteDoc } from "@webforge/model";
import type { Finding } from "@webforge/site-check";
import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { describeDetail, describePlace } from "./describe.js";

/** The starter site, with a menu item to a page and one in a dropdown. */
function site(): SiteDoc {
  const base = starterSite({ name: "Rosa's" });
  return {
    ...base,
    layout: {
      header: [{ type: "Heading", props: { id: "logo", text: "Rosa's", layerName: "Logo" } }],
      footer: [{ type: "Text", props: { id: "small", text: "<p>Thanks</p>" } }],
    },
    menu: {
      follows: "custom",
      items: [
        { id: "home" as never, hidden: false, kind: "page", pageId: base.homePageId },
        {
          id: "more" as never,
          hidden: false,
          kind: "group",
          label: "More",
          children: [
            {
              id: "prices" as never,
              hidden: false,
              kind: "link",
              label: "Prices",
              link: { kind: "url", href: "https://rosas.co.uk" },
            },
          ],
        },
      ],
    } as SiteDoc["menu"],
  };
}

const at = (place: Finding["place"], values?: Finding["values"]): Finding => ({
  key: "k",
  place,
  ...(values === undefined ? {} : { values }),
});

describe("describePlace", () => {
  const doc = site();
  const name = (finding: Finding) => describePlace(finding, doc, siteLibrary);

  it("names elements by their given name or kind, and where they are", () => {
    expect(name(at({ kind: "element", on: "header", nodeId: "logo" }))).toBe("Logo in the Header");
    expect(name(at({ kind: "element", on: "footer", nodeId: "small" }))).toBe("Text in the Footer");
  });

  it("never names an element or a shared section by its id, when it can't find it (#1170)", () => {
    expect(name(at({ kind: "element", on: doc.homePageId, nodeId: "LD5wURuiGOJhw1YE" }))).toBe(
      "An element on Rosa's",
    );
    // A Puck id says what the element is.
    const question = "FaqItem-17778910-5602-4ae7-8159-ca92d1990903";
    expect(name(at({ kind: "element", on: doc.homePageId, nodeId: question }))).toBe(
      "Question on Rosa's",
    );
    expect(name(at({ kind: "element", on: "Nope-1234" as SharedSectionId, nodeId: "gone" }))).toBe(
      "An element in a shared section",
    );
  });

  it("names a shared section by its name, and one without a name by what it is (#1170)", () => {
    const section = (id: string, name: string) => ({
      id: id as never,
      name,
      section: {
        type: "Section",
        props: { id: `${id}-section`, children: [{ type: "Heading", props: { id: `${id}-h` } }] },
      },
    });
    const shared = {
      ...doc,
      sharedSections: { offers: section("offers", "Offers"), blank: section("blank", " ") },
    };
    const named = (on: string, nodeId: string) =>
      describePlace(at({ kind: "element", on: on as never, nodeId }), shared, siteLibrary);
    expect(named("offers", "offers-h")).toBe("Heading in the shared section Offers");
    expect(named("blank", "blank-h")).toBe("Heading in a shared section");
  });

  it("names menu items by their label or their page's title, in dropdowns too", () => {
    expect(name(at({ kind: "menu", itemId: "home" }))).toBe("Menu item Rosa's");
    expect(name(at({ kind: "menu", itemId: "prices" }))).toBe("Menu item Prices");
  });

  it("names pages, untitled ones by file, Media by file name, the theme by its colours", () => {
    const untitled = {
      ...doc,
      pages: {
        ...doc.pages,
        [doc.homePageId]: { ...(doc.pages[doc.homePageId] as SiteDoc["pages"][PageId]), title: "" },
      },
    };
    expect(describePlace(at({ kind: "page", pageId: doc.homePageId }), untitled, siteLibrary)).toBe(
      "Untitled page (index.html)",
    );
    expect(name(at({ kind: "media", mediaId: "m" as MediaId }, { name: "menu.pdf" }))).toBe(
      "menu.pdf",
    );
    expect(
      name(
        at(
          { kind: "theme" },
          { palette: "inverse", foreground: "primary", background: "base-100" },
        ),
      ),
    ).toBe("Brand on Surface, in reversed sections");
    // In the Theme tab's words (#1174).
    expect(
      name(
        at({ kind: "theme" }, { palette: "colors", foreground: "primary", background: "base-300" }),
      ),
    ).toBe("Brand is hard to read on Third surface");
    // One of the person's own colours (TC-1a), by its name in the theme.
    const sky = { id: "sky", name: "Sky", color: { l: 0.9, c: 0.05, h: 240 } };
    const withSky = { ...doc, theme: { ...doc.theme, ownColors: [sky] } };
    const finding = at(
      { kind: "theme" },
      { palette: "colors", foreground: "own-sky", background: "base-100" },
    );
    expect(describePlace(finding, withSky, siteLibrary)).toBe("Sky is hard to read on Surface");
    expect(name(at({ kind: "address" }))).toBe("Site Settings › Web address");
    expect(name(at({ kind: "code", part: "css" }))).toBe("Custom Code › Stylesheet");
    // Being found (3.17).
    expect(name(at({ kind: "contact", field: "openingHours" }))).toBe(
      "Site Settings › Opening hours",
    );
    expect(name(at({ kind: "search" }))).toBe("Site Settings › Search engines");
    expect(name(at({ kind: "guide", guide: "searchConsole" }))).toBe("Open Google Search Console");
  });
});

describe("describeDetail", () => {
  it("gives a ratio, a size in pixels or in MB, or nothing", () => {
    const place = { kind: "theme" } as const;
    expect(describeDetail(at(place, { ratio: 2.1, required: 4.5 }))).toBe("2.1:1, needs 4.5:1");
    // An icon's or a logo's, which needs less than text (#670).
    expect(describeDetail(at(place, { ratio: 2.48, required: 3, drawn: "graphic" }))).toBe(
      "2.48:1, needs 3:1 for an icon or logo",
    );
    // Text on a gradient, at its harder end, with a colour that reads on both if one does (CT-13).
    expect(describeDetail(at(place, { ratio: 1, required: 4.5, on: "gradient" }))).toBe(
      "1:1 at one end of its gradient, needs 4.5:1",
    );
    expect(
      describeDetail(
        at(place, { ratio: 3.2, required: 4.5, on: "gradient", suggested: "primary-900" }),
      ),
    ).toBe("3.2:1 at one end of its gradient, needs 4.5:1. Brand, shade 900 reads on both ends");
    expect(describeDetail(at(place, { width: 6000, height: 4000 }))).toBe("6000 × 4000 pixels");
    expect(describeDetail(at(place, { bytes: 12_500_000 }))).toMatch(/12\.5/);
    expect(describeDetail(at(place))).toBeUndefined();
    expect(describeDetail(at(place, { name: "x" }))).toBeUndefined();
    // A file from another website, by its address (3.9).
    expect(describeDetail(at(place, { url: "https://cdn.example.com/a.js", kind: "script" }))).toBe(
      "https://cdn.example.com/a.js",
    );
    // One that can't be allowed, as Settings take https:// only.
    expect(describeDetail(at(place, { url: "http://cdn.example.com/a.js", kind: "script" }))).toBe(
      "http://cdn.example.com/a.js: change it to https://, or remove it",
    );
    // A stylesheet rule that matches nothing, by its selector (6.8).
    expect(describeDetail(at(place, { selector: ".heor" }))).toBe(
      ".heor: nothing on your site matches it",
    );
  });

  it("gives a page's main headings, and the page it shares a title or description with (3.17)", () => {
    const place = { kind: "page", pageId: "page-about" as PageId } as const;
    expect(describeDetail(at(place, { headings: 0 }))).toBe(
      "No main heading: add a large Heading or a Hero",
    );
    expect(describeDetail(at(place, { headings: 3 }))).toBe(
      "3 main headings: keep one large Heading or Hero",
    );
    expect(describeDetail(at(place, { sameAs: "menu/cakes.html" }))).toBe(
      "The same as menu/cakes.html",
    );
  });

  it("gives the year a published site shows (F-CM-8)", () => {
    const place = { kind: "element", on: "footer", nodeId: "copyright" } as const;
    expect(describeDetail(at(place, { publishedYear: 2026 }))).toBe("Shows 2026");
  });
});
