import { describe, expect, it } from "vitest";
import { findBrokenLinks } from "./broken-links.js";
import type { NodeDoc } from "./documents.js";
import type { PageId } from "./ids.js";
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
});
