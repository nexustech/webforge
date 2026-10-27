import type { MediaMeta } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { element, file, findIn, image, siteWith } from "../test-site.test-helper.js";
import { largeFilesRule, largeImagesRule } from "./media.js";

const media = (...items: MediaMeta[]) => Object.fromEntries(items.map((item) => [item.id, item]));

describe("large images", () => {
  it("lists each image the site shows that is over 4000 px wide or tall, once", () => {
    const site = siteWith(
      [
        element("Image", "a", { image: { mediaId: "wide" } }),
        element("Image", "b", { image: { mediaId: "wide" } }),
        element("Image", "c", { image: { mediaId: "tall" } }),
        element("Image", "d", { image: { mediaId: "fine" } }),
        element("Image", "e", { image: { mediaId: "media-gone" } }),
      ],
      {
        media: media(
          image("wide", { width: 6000, height: 4000 }),
          image("tall", { width: 3000, height: 4001 }),
          image("fine", { width: 4000, height: 4000 }),
          image("unused", { width: 8000, height: 6000 }),
        ),
      },
    );

    expect(findIn(largeImagesRule, site)).toEqual([
      {
        key: "wide",
        place: { kind: "media", mediaId: "wide" },
        values: { name: "wide.jpg", width: 6000, height: 4000 },
      },
      expect.objectContaining({ key: "tall" }),
    ]);
  });
});

describe("large files (F-ED-24)", () => {
  it("tips files over 10 MB that pages or the menu link to, not unlinked ones", () => {
    const link = (mediaId: string) => ({ kind: "file", mediaId });
    const site = siteWith(
      [
        element("Button", "menu", { label: "Menu", link: link("big") }),
        element("Button", "price", { label: "Prices", link: link("small") }),
        element("Button", "old", { label: "Old", link: link("hidden"), hidden: true }),
      ],
      {
        media: media(
          file("big", 12_000_000),
          file("small", 10_000_000),
          file("hidden", 50_000_000),
          file("unlinked", 50_000_000),
          image("photo"),
        ),
      },
    );
    const withMenu = {
      ...site,
      menu: {
        follows: "custom" as const,
        items: [
          {
            id: "item" as never,
            hidden: false,
            kind: "link" as const,
            label: "Brochure",
            link: link("brochure") as never,
          },
        ],
      },
      media: { ...site.media, ...media(file("brochure", 20_000_000)) },
    };

    expect(findIn(largeFilesRule, withMenu)).toEqual([
      {
        key: "brochure",
        place: { kind: "media", mediaId: "brochure" },
        values: { name: "brochure.pdf", bytes: 20_000_000 },
      },
      expect.objectContaining({ key: "big" }),
    ]);
  });
});
