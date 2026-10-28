import type { MediaId, PageId, SiteDoc } from "@webforge/model";
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
    expect(name(at({ kind: "element", on: doc.homePageId, nodeId: "gone" }))).toBe(
      "gone on Rosa's",
    );
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
    expect(name(at({ kind: "address" }))).toBe("Site Settings › Web address");
    expect(name(at({ kind: "code", part: "css" }))).toBe("Custom Code › Stylesheet");
  });
});

describe("describeDetail", () => {
  it("gives a ratio, a size in pixels or in MB, or nothing", () => {
    const place = { kind: "theme" } as const;
    expect(describeDetail(at(place, { ratio: 2.1, required: 4.5 }))).toBe("2.1:1, needs 4.5:1");
    expect(describeDetail(at(place, { width: 6000, height: 4000 }))).toBe("6000 × 4000 pixels");
    expect(describeDetail(at(place, { bytes: 12_500_000 }))).toMatch(/12\.5/);
    expect(describeDetail(at(place))).toBeUndefined();
    expect(describeDetail(at(place, { name: "x" }))).toBeUndefined();
    // A file from another website, by its address (3.9).
    expect(describeDetail(at(place, { url: "https://cdn.example.com/a.js", kind: "script" }))).toBe(
      "https://cdn.example.com/a.js",
    );
  });
});
