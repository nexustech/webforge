import { t } from "@webforge/i18n";
import {
  type MediaId,
  type MediaMeta,
  type NodeDoc,
  type PageId,
  SHARED_COPY_TYPE,
  type SharedSectionId,
  type SiteDoc,
} from "@webforge/model";
import { CATALOGUE } from "@webforge/site-components/catalogue-data";
import { describe, expect, it } from "vitest";
import { runRule } from "../check.js";
import { element, findIn, image, siteWith } from "../test-site.test-helper.js";
import {
  altTextRule,
  brokenLinksRule,
  draftLinksRule,
  missingImagesRule,
  outdatedYearRule,
  pastAnnouncementRule,
  placeholdersRule,
} from "./content.js";

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

/**
 * `site` with a page `id` holding `content`, a draft unless `draft` is false (G37, #864), and a
 * menu item for it.
 */
function withPage(site: SiteDoc, id: string, content: NodeDoc[], draft = true): SiteDoc {
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  const pageId = id as PageId;
  return {
    ...site,
    pages: {
      ...site.pages,
      [pageId]: {
        ...home,
        id: pageId,
        slug: id,
        title: "Winter menu",
        settings: { ...home.settings, ...(draft ? { draft } : {}) },
        doc: { root: { props: {} }, content },
      },
    },
    pageOrder: [...site.pageOrder, pageId],
    menu: {
      follows: "custom",
      items: [{ id: "item" as never, hidden: false, kind: "page", pageId }],
    },
  };
}

describe("links to draft pages (G37, #864)", () => {
  const toWinter = { kind: "page", pageId: "winter" };

  it("lists each published link to a draft page, with its name, but not the menu's item", () => {
    const site = withPage(
      siteWith([
        element("Button", "shown", { label: "Winter", link: toWinter }),
        element("Button", "unpublished", { label: "Old", link: toWinter, hidden: true }),
        element("Button", "while", { label: "Soon", link: { ...toWinter, anchor: "soups" } }),
      ]),
      "winter",
      [],
    );

    expect(findIn(draftLinksRule, site)).toEqual([
      {
        key: `${site.homePageId}/shown/winter#`,
        place: { kind: "element", on: site.homePageId, nodeId: "shown" },
        values: { pageId: "winter", draftPage: "Winter menu" },
      },
      {
        key: `${site.homePageId}/while/winter#soups`,
        place: { kind: "element", on: site.homePageId, nodeId: "while" },
        values: { pageId: "winter", draftPage: "Winter menu" },
      },
    ]);
    // A link to a draft page isn't broken: the page is there. One to a section it lacks still is.
    expect(findIn(brokenLinksRule, site).map((finding) => finding.key)).toEqual([
      `${site.homePageId}/while/winter#soups`,
    ]);
  });

  it("finds none once the page is published, and none on the draft page itself", () => {
    const linking = [element("Button", "shown", { label: "Winter", link: toWinter })];

    expect(findIn(draftLinksRule, withPage(siteWith(linking), "winter", [], false))).toEqual([]);
    // A draft linking to itself, or to another draft, isn't published either.
    expect(findIn(draftLinksRule, withPage(siteWith(), "winter", linking))).toEqual([]);
  });

  it("checks nothing on a draft page: its broken links and placeholders wait for it", () => {
    const gone = { kind: "page", pageId: "page-gone" };
    const content = [element("Button", "dead", { label: "Gone", link: gone })];

    expect(findIn(brokenLinksRule, withPage(siteWith(), "winter", content))).toEqual([]);
    expect(
      findIn(brokenLinksRule, withPage(siteWith(), "winter", content, false)).map(
        (finding) => finding.key,
      ),
    ).toEqual(["winter/dead/page-gone#"]);
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

  it("asks no alt text of a picture its layout doesn't show: a Text only Hero's (#670)", () => {
    const site = siteWith(
      [
        element("Hero", "textOnly", { variant: "minimal", image: { mediaId: "bare" } }),
        element("Hero", "split", { variant: "split", image: { mediaId: "bare" } }),
      ],
      { media: media(image("bare", { alt: "" })) },
    );

    expect(findIn(altTextRule, site)).toEqual([
      expect.objectContaining({ key: `${site.homePageId}/split/image` }),
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

describe("outdated year (F-CM-8)", () => {
  const site = siteWith([
    element("Text", "hidden", { text: "<p>© {year} Rosa's</p>", hidden: true }),
    element("Heading", "title", { text: "Rosa's Bakery" }),
    element("Text", "copyright", { text: "<p>© {YEAR} Rosa's Bakery</p>" }),
    element("Text", "again", { text: "<p>Since 1990, still baking in {year}</p>" }),
  ]);
  const year = (published?: { year: number; thisYear: number }) =>
    outdatedYearRule.check({
      site,
      catalogue: CATALOGUE,
      ...(published === undefined ? {} : { published }),
    });

  it("tips once, at the first exported text with {year}, when the site was published in an earlier year", () => {
    expect(year({ year: 2026, thisYear: 2027 })).toEqual([
      {
        key: "2026/2027",
        place: { kind: "element", on: site.homePageId, nodeId: "copyright" },
        values: { publishedYear: 2026 },
      },
    ]);
  });

  it("says nothing when the site was published this year, or hasn't been", () => {
    expect(year({ year: 2027, thisYear: 2027 })).toEqual([]);
    expect(year()).toEqual([]);
  });

  it("tips at a page whose title or description has {year}, when no element's text does", () => {
    const plain = siteWith([element("Text", "copyright", { text: "<p>© Rosa's</p>" })]);
    const home = plain.pages[plain.homePageId];
    if (home === undefined) throw new Error("no home page");
    const offers = {
      ...plain,
      pages: {
        ...plain.pages,
        [home.id]: { ...home, settings: { ...home.settings, description: "Our {year} cakes" } },
      },
    };
    expect(
      outdatedYearRule.check({
        site: offers,
        catalogue: CATALOGUE,
        published: { year: 2026, thisYear: 2027 },
      }),
    ).toEqual([expect.objectContaining({ place: { kind: "page", pageId: plain.homePageId } })]);
  });

  it("tips at Custom Code with {year} outside its scripts and styles, as the export fills it in", () => {
    const check = (code: string, settings?: { head?: string; bodyEnd?: string }) => {
      const custom = siteWith([element("CustomCode", "widget", { code })]);
      return outdatedYearRule.check({
        site:
          settings === undefined ? custom : { ...custom, code: { ...custom.code, ...settings } },
        catalogue: CATALOGUE,
        published: { year: 2026, thisYear: 2027 },
      });
    };
    const inScript = "<script>const year = `{year}`;</script><style>/* {year} */</style>";

    expect(check("<p>© {year} Rosa's</p>")).toEqual([
      expect.objectContaining({
        place: { kind: "element", on: expect.any(String), nodeId: "widget" },
      }),
    ]);
    // A script's or a style's {year} stays as written: nothing to say.
    expect(check(inScript)).toEqual([]);
    // Settings' Custom Code goes into every page: its HTML, but not its scripts.
    expect(check(inScript, { bodyEnd: "<footer>© {year}</footer>" })).toEqual([
      expect.objectContaining({ place: { kind: "code", part: "bodyEnd" } }),
    ]);
    expect(check(inScript, { head: inScript })).toEqual([]);
  });

  it("says nothing when no text has {year}", () => {
    expect(
      outdatedYearRule.check({
        site: siteWith([element("Text", "copyright", { text: "<p>© 2026 Rosa's</p>" })]),
        catalogue: CATALOGUE,
        published: { year: 2026, thisYear: 2027 },
      }),
    ).toEqual([]);
  });
});

describe("an Announcement bar past its last day (6.4)", () => {
  const bar = (id: string, lastDay: string, props: Record<string, unknown> = {}) =>
    element("AnnouncementBar", id, { text: "Closed 24–26 December", lastDay, ...props });
  const site = siteWith([
    bar("on-the-page", "2026-12-20"),
    bar("hidden", "2026-12-01", { hidden: true }),
  ]);
  const withBars = {
    ...site,
    layout: { ...site.layout, header: [bar("every-page", "2026-12-26"), ...site.layout.header] },
  };
  const past = (today?: string) =>
    pastAnnouncementRule.check({
      site: withBars,
      catalogue: CATALOGUE,
      ...(today === undefined ? {} : { today }),
    });

  it("tips at each shown bar whose last day was before today, keyed by its last day", () => {
    expect(past("2026-12-27")).toEqual([
      {
        key: "header/every-page/2026-12-26",
        place: { kind: "element", on: "header", nodeId: "every-page" },
      },
      {
        key: `${site.homePageId}/on-the-page/2026-12-20`,
        place: { kind: "element", on: site.homePageId, nodeId: "on-the-page" },
      },
    ]);
  });

  it("says nothing on its last day, for a bar with none, or without today", () => {
    expect(past("2026-12-20")).toEqual([]);
    expect(past()).toEqual([]);
    expect(
      pastAnnouncementRule.check({
        site: siteWith([bar("no-day", "")]),
        catalogue: CATALOGUE,
        today: "2027-01-01",
      }),
    ).toEqual([]);
  });

  it("tips at a bar hidden only while editing, which is published, but not on a draft page", () => {
    const editing = siteWith([bar("editing", "2026-12-20", { editorHidden: true })]);
    const drafted = withPage(siteWith(), "winter", [bar("draft", "2026-12-20")]);
    const tips = (on: SiteDoc) =>
      runRule(pastAnnouncementRule, { site: on, catalogue: CATALOGUE, today: "2027-01-01" });

    expect(tips(editing)).toEqual([
      expect.objectContaining({ key: expect.stringContaining("/editing/") }),
    ]);
    expect(tips(drafted)).toEqual([]);
  });

  it("has its texts", () => {
    expect(t("siteCheck.rule.pastAnnouncement.fail.one")).toContain("Delete it");
  });
});
