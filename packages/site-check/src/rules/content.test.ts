import { t } from "@webforge/i18n";
import {
  type MediaId,
  type MediaMeta,
  type NodeDoc,
  SHARED_COPY_TYPE,
  type SharedSectionId,
} from "@webforge/model";
import { describe, expect, it } from "vitest";
import { element, findIn, image, siteWith } from "../test-site.test-helper.js";
import { altTextRule, brokenLinksRule, missingImagesRule, placeholdersRule } from "./content.js";

const media = (...items: MediaMeta[]) => Object.fromEntries(items.map((item) => [item.id, item]));

describe("broken links", () => {
  it("lists links to pages that are gone, by element or menu item, but not in hidden elements", () => {
    const gone = { kind: "page", pageId: "page-gone" };
    const site = siteWith([
      element("Button", "shown", { label: "Menu", link: gone }),
      element("Button", "hidden", { label: "Old", link: gone, hidden: true }),
    ]);
    const withMenu = {
      ...site,
      menu: {
        follows: "custom" as const,
        items: [
          {
            id: "item" as never,
            hidden: false,
            kind: "page" as const,
            pageId: gone.pageId as never,
          },
        ],
      },
    };

    expect(findIn(brokenLinksRule, withMenu)).toEqual([
      { key: "menu/item/page-gone#", place: { kind: "menu", itemId: "item" } },
      {
        key: `${site.homePageId}/shown/page-gone#`,
        place: { kind: "element", on: site.homePageId, nodeId: "shown" },
      },
    ]);
  });

  it("counts links in a shared section only while a page holds a copy of it (F-ED-23)", () => {
    const gone = { kind: "page", pageId: "page-gone" };
    const shared = (copies: NodeDoc[]) => ({
      ...siteWith(copies),
      sharedSections: {
        hours: {
          id: "hours" as SharedSectionId,
          name: "Hours",
          section: element("Section", "s", { content: [element("Button", "in", { link: gone })] }),
        },
      },
    });
    const copy = element(SHARED_COPY_TYPE, "c1", { sharedSectionId: "hours" });

    expect(findIn(brokenLinksRule, shared([]))).toEqual([]);
    expect(findIn(brokenLinksRule, shared([copy])).map((finding) => finding.place)).toEqual([
      { kind: "element", on: "hours", nodeId: "in" },
    ]);
  });

  it("keys a missing document by its id, so each broken target is its own finding", () => {
    const site = siteWith([
      element("Button", "doc", { label: "Menu", link: { kind: "file", mediaId: "media-gone" } }),
    ]);

    expect(findIn(brokenLinksRule, site).map((finding) => finding.key)).toEqual([
      `${site.homePageId}/doc/media-gone`,
    ]);
  });
});

describe("missing images and alt text", () => {
  const placed = (id: string, value: unknown) => element("Image", id, { image: value });

  it("finds images deleted from Media that a page still places", () => {
    const site = siteWith(
      [placed("gone", { mediaId: "media-gone" }), placed("here", { mediaId: "photo" })],
      {
        media: media(image("photo")),
      },
    );

    expect(findIn(missingImagesRule, site)).toEqual([
      {
        key: `${site.homePageId}/gone/image`,
        place: { kind: "element", on: site.homePageId, nodeId: "gone" },
      },
    ]);
  });

  it("finds placements without alt text, the image's own or the placement's", () => {
    const site = siteWith(
      [
        placed("none", { mediaId: "bare" }),
        placed("own", { mediaId: "bare", alt: "Our shop window" }),
        placed("inherited", { mediaId: "photo" }),
        placed("blanked", { mediaId: "photo", alt: " " }),
        placed("gone", { mediaId: "media-gone" }),
      ],
      { media: media(image("bare", { alt: "" }), image("photo")) },
    );

    expect(findIn(altTextRule, site)).toEqual([
      expect.objectContaining({
        key: `${site.homePageId}/none/image`,
        values: { image: "bare.jpg" },
      }),
      expect.objectContaining({ key: `${site.homePageId}/blanked/image` }),
    ]);
  });

  it("asks no alt text of a section's background image, which is decorative (2.26)", () => {
    const site = siteWith(
      [element("Section", "s", { backgroundImage: { mediaId: "bare" }, content: [] })],
      { media: media(image("bare", { alt: "" })) },
    );

    expect(findIn(altTextRule, site)).toEqual([]);
    // Deleted from Media, it's still a gap.
    expect(findIn(missingImagesRule, { ...site, media: {} })).toHaveLength(1);
  });

  it("checks images in a list's items too", () => {
    const site = siteWith([
      element("Testimonial", "quote", { photo: { mediaId: "bare" as MediaId } }),
    ]);

    expect(findIn(missingImagesRule, site).map((finding) => finding.key)).toEqual([
      `${site.homePageId}/quote/photo`,
    ]);
  });
});

describe("placeholders", () => {
  const keys = (nodes: Parameters<typeof siteWith>[0]) => {
    const site = siteWith(nodes);
    return findIn(placeholdersRule, site).map((finding) =>
      finding.key.slice(site.homePageId.length + 1),
    );
  };

  it("finds the starter texts that tell the owner what to write", () => {
    expect(
      keys([
        element("Text", "starter", { text: `<p>${t("starter.text")}</p>` }),
        element("Text", "blank", { text: "<p>Tell visitors your story: how you started.</p>" }),
        element("Heading", "fine", { text: "Fresh bread daily" }),
        element("Button", "label", { label: t("starter.buttonLabel") }),
      ]),
    ).toEqual(["starter/text", "blank/text"]);
  });

  it("finds a default that only names its element, dummy Latin and example links", () => {
    expect(
      keys([
        element("Heading", "heading", { text: "Heading" }),
        element("Text", "latin", { text: "<p>Lorem ipsum dolor sit amet.</p>" }),
        element("Text", "linked", {
          text: '<p>See <a href="https://example.com/menu">menu</a></p>',
        }),
        element("Button", "url", {
          label: "Menu",
          link: { kind: "url", href: "https://www.example.org" },
        }),
        element("Button", "mail", {
          label: "Mail",
          link: { kind: "email", address: "me@example.net" },
        }),
        element("Button", "real", {
          label: "Mail",
          link: { kind: "email", address: "me@rosas.co.uk" },
        }),
        element("Text", "lookalike", { text: '<p><a href="https://myexample.com">Ours</a></p>' }),
      ]),
    ).toEqual(["heading/text", "latin/text", "linked/text", "url/link", "mail/link"]);
  });

  it("finds them in elements in slots: a List's starter items", () => {
    expect(
      keys([
        element("Section", "section", {
          content: [element("ListItem", "item", { text: t("starter.listItem") })],
        }),
      ]),
    ).toEqual(["item/text"]);
  });

  it("finds them in a list field's items: a form field's choices", () => {
    expect(
      keys([
        element("FormField", "choice", {
          options: [
            { id: "a", label: "Bread" },
            { id: "b", label: "Lorem ipsum" },
          ],
        }),
      ]),
    ).toEqual(["choice/options.1.label"]);
  });
});
