import { createSite, type MediaId, type MenuItemId } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import { exportRequestFor } from "./export-request.js";

describe("exportRequestFor", () => {
  it("names the images the site uses by hash, with their alt text, focal point and crop", () => {
    const site = createSite({
      name: "Rosa's Bakery",
      language: "en-GB",
      homeTitle: "Home",
      notFoundTitle: "Page not found",
    });
    site.media = {
      ["hero" as MediaId]: {
        id: "hero" as MediaId,
        hash: "a".repeat(64),
        name: "hero",
        fileName: "hero.jpg",
        kind: "image",
        mimeType: "image/jpeg",
        width: 1600,
        height: 1000,
        alt: "Our shop",
        focal: { x: 0.3, y: 0.5 },
      },
      // In Media, but on no page: its bytes needn't be read.
      ["unused" as MediaId]: {
        id: "unused" as MediaId,
        hash: "c".repeat(64),
        name: "unused",
        fileName: "unused.jpg",
        kind: "image",
        mimeType: "image/jpeg",
        width: 10,
        height: 10,
        alt: "",
      },
      ["prices" as MediaId]: {
        id: "prices" as MediaId,
        hash: "b".repeat(64),
        name: "prices",
        fileName: "prices.pdf",
        kind: "file",
        mimeType: "application/pdf",
      },
    };

    const home = site.pages[site.homePageId];
    if (home === undefined) throw new Error("no home page");
    home.doc.content = [
      { type: "Hero", props: { id: "hero", title: "Fresh", image: { mediaId: "hero" } } },
    ];

    const request = exportRequestFor(site, siteLibrary);

    // The PDF is in Media but nothing links to it: not sent.
    expect(request.documents).toEqual([]);
    expect(request.snapshot.media).toEqual([]);
    expect(request.media).toEqual([
      {
        id: "hero",
        name: "hero",
        mimeType: "image/jpeg",
        hash: "a".repeat(64),
        alt: "Our shop",
        focal: { x: 0.3, y: 0.5 },
      },
    ]);
  });

  it("names the documents pages link to by hash, and only those (1.28)", () => {
    const site = createSite({
      name: "Rosa's Bakery",
      language: "en-GB",
      homeTitle: "Home",
      notFoundTitle: "Page not found",
    });
    const document = (id: string) => ({
      id: id as MediaId,
      hash: id.padEnd(64, "0"),
      name: id,
      fileName: `${id}.pdf`,
      kind: "file" as const,
      mimeType: "application/pdf" as const,
    });
    site.media = { ["a1" as MediaId]: document("a1"), ["b2" as MediaId]: document("b2") };
    const home = site.pages[site.homePageId];
    if (home === undefined) throw new Error("no home page");
    home.doc.content = [
      {
        type: "Hero",
        props: { id: "hero", title: "Prices", buttonLink: { kind: "file", mediaId: "a1" } },
      },
    ];

    expect(exportRequestFor(site, siteLibrary).documents).toEqual([
      { id: "a1", name: "a1", mimeType: "application/pdf", hash: "a1".padEnd(64, "0") },
    ]);

    // The navigation menu can link to one too.
    site.menu = {
      follows: "custom",
      items: [
        {
          id: "m1" as MenuItemId,
          kind: "link",
          label: "Menu",
          hidden: false,
          link: { kind: "file", mediaId: "b2" as MediaId },
        },
      ],
    };
    expect(exportRequestFor(site, siteLibrary).documents?.map((item) => item.id)).toEqual([
      "a1",
      "b2",
    ]);
  });
});
