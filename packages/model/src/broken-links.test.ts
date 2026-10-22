import { describe, expect, it } from "vitest";
import { findBrokenLinks } from "./broken-links.js";
import type { NodeDoc } from "./documents.js";
import type { MediaId, PageId, SharedSectionId } from "./ids.js";
import { SHARED_COPY_TYPE } from "./shared-sections.js";
import { createSite, type SiteDoc } from "./site-doc.js";

const ABOUT = "page-about" as PageId;

/** A site with an About page holding an "opening-times" section, and `home` on its home page. */
function site(home: NodeDoc[], header: NodeDoc[] = []): SiteDoc {
  const base = createSite({
    name: "Bakery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Not found",
  });
  const homePage = base.pages[base.homePageId];
  if (homePage === undefined) throw new Error("no home page");
  return {
    ...base,
    layout: { header, footer: [] },
    pages: {
      ...base.pages,
      [base.homePageId]: { ...homePage, doc: { root: { props: {} }, content: home } },
      [ABOUT]: {
        ...homePage,
        id: ABOUT,
        slug: "about",
        title: "About",
        doc: {
          root: { props: {} },
          content: [
            {
              type: "Section",
              props: { id: "times", advanced: { anchorId: "opening-times" }, content: [] },
            },
          ],
        },
      },
    },
    pageOrder: [...base.pageOrder, ABOUT],
  };
}

const button = (id: string, link: unknown): NodeDoc => ({
  type: "Hero",
  props: { id, buttonLink: link },
});

describe("findBrokenLinks (F-ED-18)", () => {
  it("finds no problem with links to existing pages and sections", () => {
    expect(
      findBrokenLinks(
        site([
          button("a", { kind: "page", pageId: ABOUT }),
          button("b", { kind: "page", pageId: ABOUT, anchor: "opening-times" }),
          button("c", { kind: "url", href: "https://example.com" }),
        ]),
      ),
    ).toEqual([]);
  });

  it("finds sections in copies of shared sections, by each copy's anchor (F-ED-23)", () => {
    const HOURS = "shared-hours" as SharedSectionId;
    const withCopies = site([
      button("first", { kind: "page", pageId: ABOUT, anchor: "hours" }),
      button("second", { kind: "page", pageId: ABOUT, anchor: "hours-2" }),
      button("third", { kind: "page", pageId: ABOUT, anchor: "hours-3" }),
    ]);
    withCopies.sharedSections = {
      [HOURS]: {
        id: HOURS,
        name: "Opening hours",
        section: {
          type: "Section",
          props: {
            id: "s",
            advanced: { anchorId: "hours" },
            content: [button("inside", { kind: "page", pageId: "page-gone" })],
          },
        },
      },
    };
    withCopies.pages[ABOUT]?.doc.content.push(
      { type: SHARED_COPY_TYPE, props: { id: "c1", sharedSectionId: HOURS } },
      { type: SHARED_COPY_TYPE, props: { id: "c2", sharedSectionId: HOURS, anchorSuffix: "2" } },
    );

    expect(findBrokenLinks(withCopies)).toEqual([
      { on: withCopies.homePageId, nodeId: "third", pageId: ABOUT, anchor: "hours-3" },
      // A link inside the shared section is on every page with a copy: named by the section.
      { on: HOURS, nodeId: "inside", pageId: "page-gone" },
    ]);
  });

  it("keeps a link to a section valid when the section is renamed in Layers", () => {
    const renamed = site([button("b", { kind: "page", pageId: ABOUT, anchor: "opening-times" })]);
    const section = renamed.pages[ABOUT]?.doc.content[0];
    if (section === undefined) throw new Error("no section");
    // Renaming sets the layer's name; the anchor links use stays as it is.
    section.props.layerName = "Hours";

    expect(findBrokenLinks(renamed)).toEqual([]);
  });

  it("flags links to a deleted page or a section that's gone, naming their element", () => {
    const home = site([
      button("gone", { kind: "page", pageId: "page-gone" }),
      {
        type: "Section",
        props: {
          id: "s",
          content: [button("inner", { kind: "page", pageId: ABOUT, anchor: "prices" })],
        },
      },
    ]);

    expect(findBrokenLinks(home)).toEqual([
      { on: home.homePageId, nodeId: "gone", pageId: "page-gone" },
      { on: home.homePageId, nodeId: "inner", pageId: ABOUT, anchor: "prices" },
    ]);
  });

  it("checks the links in rich text too (F-ED-3)", () => {
    const text: NodeDoc = {
      type: "Text",
      props: {
        id: "t",
        text:
          '<p><a href="webforge:page/page-about#opening-times">Hours</a> ' +
          '<a href="webforge:page/page-gone">Old</a> ' +
          '<a href="webforge:page/page-about#prices">Prices</a></p>',
      },
    };
    const home = site([text]);

    expect(findBrokenLinks(home)).toEqual([
      { on: home.homePageId, nodeId: "t", pageId: "page-gone" },
      { on: home.homePageId, nodeId: "t", pageId: ABOUT, anchor: "prices" },
    ]);
  });

  it("checks the menu's page and section items, in dropdowns too", () => {
    const withMenu = site([]);
    withMenu.menu = {
      follows: "custom",
      items: [
        { id: "m1" as never, kind: "page", pageId: "page-gone" as PageId, hidden: false },
        {
          id: "m2" as never,
          kind: "group",
          label: "More",
          hidden: false,
          children: [
            {
              id: "m3" as never,
              kind: "section",
              label: "Prices",
              hidden: false,
              link: { kind: "page", pageId: ABOUT, anchor: "prices" },
            },
          ],
        },
      ],
    };

    expect(findBrokenLinks(withMenu)).toEqual([
      { on: "menu", nodeId: "m1", pageId: "page-gone" },
      { on: "menu", nodeId: "m3", pageId: ABOUT, anchor: "prices" },
    ]);
  });

  it("counts the Header's anchors on every page, and checks the Header's own links", () => {
    const withHeader = site(
      [button("a", { kind: "page", pageId: ABOUT, anchor: "top" })],
      [
        {
          type: "Header",
          props: {
            id: "h",
            advanced: { anchorId: "top" },
            items: [{ kind: "page", pageId: "page-gone" }],
          },
        },
      ],
    );

    expect(findBrokenLinks(withHeader)).toEqual([
      { on: "header", nodeId: "h", pageId: "page-gone" },
    ]);
  });

  it("finds links to documents deleted from Media, in link fields and rich text (1.28)", () => {
    const doc = site([
      { type: "Hero", props: { id: "hero", buttonLink: { kind: "file", mediaId: "gone" } } },
      {
        type: "Text",
        props: {
          id: "text",
          text: '<p><a href="webforge:file/kept">a</a> <a href="webforge:file/lost">b</a></p>',
        },
      },
    ]);
    doc.media["kept" as MediaId] = {
      id: "kept" as MediaId,
      hash: "a".repeat(64),
      name: "kept",
      fileName: "kept.pdf",
      kind: "file",
      mimeType: "application/pdf",
    };

    expect(findBrokenLinks(doc)).toEqual([
      { on: doc.homePageId, nodeId: "hero", mediaId: "gone" },
      { on: doc.homePageId, nodeId: "text", mediaId: "lost" },
    ]);
  });
});
