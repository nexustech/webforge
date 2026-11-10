import {
  anchorsIn,
  DEFAULT_THEME,
  type NodeDoc,
  type PageId,
  RICH_TEXT_PAGE_LINK,
  type SiteDoc,
  siteDocSchema,
} from "@webforge/model";
import { checkSite } from "@webforge/site-check";
import { CATALOGUE } from "@webforge/site-components/catalogue-data";
import { describe, expect, it } from "vitest";
import { readTemplate, readTemplates } from "../src/node.js";
import { recipesFor } from "../src/recipes.js";
import { retargetLinks } from "../src/retarget-links.js";
import { siteFromTemplate } from "../src/template.js";

// One-page sites (GA10, 5.9): the quick start's *One page* makes the pages sections of the home
// page, with a section link in the menu for each.

const templates = readTemplates();

/** Every element's id on `nodes`, slots included. */
function idsIn(nodes: readonly NodeDoc[]): string[] {
  return nodes.flatMap((node) => [
    node.props.id,
    ...Object.values(node.props).flatMap((value) =>
      Array.isArray(value) &&
      value.every((item) => typeof item === "object" && item !== null && "props" in item)
        ? idsIn(value as NodeDoc[])
        : [],
    ),
  ]);
}

/** The links Site Check finds broken in `site`. */
const brokenLinks = (site: SiteDoc) =>
  checkSite({ site, catalogue: CATALOGUE }, "export").results.find(
    (each) => each.rule === "brokenLinks",
  )?.findings;

describe("a one-page site from every template", () => {
  for (const { template, images } of templates) {
    it(`${template.id}: the home page holds every page's sections, linked from the menu`, () => {
      const recipes = template.category === null ? [] : recipesFor(template.category);
      const site = siteFromTemplate(template, images, {
        name: "Rosa's",
        theme: DEFAULT_THEME,
        pages: { leaveOut: [], recipes: recipes.map((recipe) => recipe.id), onePage: true },
      });

      expect(siteDocSchema.parse(site)).toEqual(site);
      const notFound = template.site.pageOrder.at(-1);
      expect(site.pageOrder).toEqual([site.homePageId, notFound]);
      const home = site.pages[site.homePageId]?.doc.content ?? [];
      // One Hero at most, and every element with an id of its own.
      expect(home.filter((node) => node.type === "Hero").length).toBeLessThanOrEqual(1);
      const ids = idsIn(home);
      expect(new Set(ids).size).toBe(ids.length);
      // A section link for each page that was merged, in page order, to an anchor on the page.
      const merged = template.site.pageOrder.length - 2 + recipes.length;
      expect(site.menu.follows).toBe("custom");
      const [first, ...rest] = site.menu.items;
      expect(first).toMatchObject({ kind: "page", pageId: site.homePageId });
      const sections = rest.filter((item) => item.kind === "section");
      expect(sections).toHaveLength(merged);
      const anchors = anchorsIn(home);
      for (const item of sections) {
        expect(item.link.pageId).toBe(site.homePageId);
        expect(anchors.has(item.link.anchor), item.label).toBe(true);
      }
      expect(new Set(sections.map((item) => item.link.anchor)).size).toBe(sections.length);
      // The Header stays in reach, and nothing links anywhere that isn't there.
      expect(site.layout.header.find((node) => node.type === "Header")?.props.sticky).toBe(true);
      expect(brokenLinks(site)).toEqual([]);
    });
  }
});

describe("mergeIntoHome on the Trades template", () => {
  const trades = readTemplate("trades");
  const make = (leaveOut: string[] = [], recipes: string[] = []) =>
    siteFromTemplate(trades.template, trades.images, {
      name: "Rosa's",
      theme: DEFAULT_THEME,
      pages: { leaveOut, recipes, onePage: true },
    });

  it("puts each page's sections after the home page's, in order, the first named after its page", () => {
    const site = make([], ["trades-faq"]);
    const home = site.pages[site.homePageId]?.doc.content ?? [];
    const before = trades.template.site.pages[trades.template.site.homePageId]?.doc.content ?? [];

    // The home page's own first, its links now to sections on it.
    const shape = (nodes: readonly NodeDoc[]) => nodes.map((node) => [node.type, node.props.id]);
    expect(shape(home.slice(0, before.length))).toEqual(shape(before));
    const labels = site.menu.items.slice(1).map((item) => item.label);
    const pages = trades.template.site.pageOrder.slice(1, -1);
    expect(labels).toEqual([...pages.map((id) => trades.template.site.pages[id]?.title), "FAQ"]);
    const anchors = home
      .map((node) => node.props.advanced?.anchorId)
      .filter((anchor) => anchor !== undefined);
    expect(anchors.at(-1)).toBe("faq");
  });

  it("sends links to a page to its section on the home page", () => {
    const site = make();
    const contact = site.menu.items.find((item) => item.label === "Contact");
    if (contact?.kind !== "section") throw new Error("No Contact section in the menu");

    expect(JSON.stringify(site.pages)).not.toContain('"pageId":"trades-contact"');
    const hero = site.pages[site.homePageId]?.doc.content.find((node) => node.type === "Hero");
    expect(hero?.props.buttonLink).toEqual({
      kind: "page",
      pageId: site.homePageId,
      newTab: false,
      anchor: contact.link.anchor,
    });
  });

  it("leaves out the pages unticked, whose links go to the top of the home page", () => {
    const site = make(["trades-contact"]);

    expect(site.menu.items.map((item) => item.label)).not.toContain("Contact");
    expect(JSON.stringify(site.pages)).not.toContain("trades-contact");
    expect(brokenLinks(site)).toEqual([]);
  });

  it("changes nothing without One page", () => {
    const site = siteFromTemplate(trades.template, trades.images, {
      name: "Rosa's",
      theme: DEFAULT_THEME,
      pages: { leaveOut: [], recipes: [] },
    });

    expect(site.pageOrder).toEqual(trades.template.site.pageOrder);
    expect(site.menu.follows).toBe("pages");
  });
});

describe("retargetLinks", () => {
  /** A site whose home page links to `about` in a button and in rich text, with an anchor. */
  function linking(): SiteDoc {
    const site = structuredClone(readTemplate("blank").template.site);
    const home = site.pages[site.homePageId];
    if (home === undefined) throw new Error("No home page");
    home.doc.content = [
      {
        type: "Button",
        props: {
          id: "button",
          label: "Go",
          link: { kind: "page", pageId: "about", anchor: "team" },
        },
      },
      {
        type: "Text",
        props: { id: "text", text: `<p><a href="${RICH_TEXT_PAGE_LINK}about#team">Team</a></p>` },
      },
    ];
    return site;
  }

  it("sends a page's links to its section, or to a section of it that came along", () => {
    const moved = linking();
    retargetLinks(moved, new Map([["about", "about-us"]]), (_page, anchor) => anchor === "team");
    const kept = moved.pages[moved.homePageId]?.doc.content;
    expect(kept?.[0]?.props.link).toEqual({
      kind: "page",
      pageId: moved.homePageId,
      anchor: "team",
    });
    expect(kept?.[1]?.props.text).toContain(`${RICH_TEXT_PAGE_LINK}${moved.homePageId}#team"`);

    const lost = linking();
    retargetLinks(lost, new Map([["about", "about-us"]]));
    const content = lost.pages[lost.homePageId]?.doc.content;
    expect(content?.[0]?.props.link).toEqual({
      kind: "page",
      pageId: lost.homePageId,
      anchor: "about-us",
    });
    expect(content?.[1]?.props.text).toContain(
      `${RICH_TEXT_PAGE_LINK}${lost.homePageId}#about-us"`,
    );

    const top = linking();
    retargetLinks(top, new Map([["about" as PageId, undefined]]));
    expect(top.pages[top.homePageId]?.doc.content[0]?.props.link).toEqual({
      kind: "page",
      pageId: top.homePageId,
    });
  });
});
