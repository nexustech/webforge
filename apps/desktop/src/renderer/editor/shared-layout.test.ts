import { createHistoryManager, syncDraft } from "@webforge/history";
import type { CollectionId, LayoutDoc, NodeDoc, PageId, SiteDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import {
  canvasLayout,
  pagesShowing,
  sharedHomeOf,
  sharedRegionOf,
  shownLayout,
  syncCanvasLayout,
  updateSharedField,
} from "./shared-layout.js";

/** The starter site, with its home page's settings changed by `settings`. */
function siteHiding(settings: { hideHeader?: boolean; hideFooter?: boolean }): SiteDoc {
  const site = starterSite();
  const home = site.pages[site.homePageId];
  if (home !== undefined) Object.assign(home.settings, settings);
  return site;
}

const layout: LayoutDoc = {
  header: [
    {
      type: "Section",
      props: { id: "header", content: [{ type: "Heading", props: { id: "logo", text: "Hi" } }] },
    },
  ],
  footer: [{ type: "Footer", props: { id: "footer", text: "Bye" } }],
};

describe("shownLayout", () => {
  it("is the site's layout where the page hides nothing", () => {
    const site = starterSite();

    expect(shownLayout(site, site.homePageId)).toBe(site.layout);
  });

  it("leaves out what the page hides, as the same object each time", () => {
    const site = siteHiding({ hideFooter: true });
    const shown = shownLayout(site, site.homePageId);

    expect(shown).toEqual({ header: site.layout.header, footer: [] });
    expect(shownLayout(site, site.homePageId)).toBe(shown);
    const bare = siteHiding({ hideHeader: true, hideFooter: true });
    expect(shownLayout(bare, bare.homePageId)).toEqual({ header: [], footer: [] });
  });

  it("shows everything for a page that isn't there", () => {
    const site = starterSite();

    expect(shownLayout(site, "page-gone" as PageId)).toBe(site.layout);
  });
});

describe("sharedRegionOf", () => {
  it("finds the region of a shared element, at any depth", () => {
    expect(sharedRegionOf(layout, "header")).toBe("header");
    expect(sharedRegionOf(layout, "logo")).toBe("header");
    expect(sharedRegionOf(layout, "footer")).toBe("footer");
    expect(sharedRegionOf(layout, "heading-1")).toBeUndefined();
  });
});

describe("pagesShowing", () => {
  it("counts the pages that don't hide the region", () => {
    const site = siteHiding({ hideHeader: true });
    const pages = Object.keys(site.pages).length;

    expect(pagesShowing(site, "header")).toBe(pages - 1);
    expect(pagesShowing(site, "footer")).toBe(pages);
  });
});

const BLOG = "blog" as CollectionId;
const POST = "post" as PageId;

const title: NodeDoc = {
  type: "Heading",
  props: { id: "post-title", text: "Title", bindings: { text: "item.title" } },
};
const back: NodeDoc = { type: "Text", props: { id: "back", text: "More news" } };

/** The starter site with `layout`, a Blog whose design is `title` and `back`, and a post. */
function siteWithPost(settings: { hideHeader?: boolean; hideFooter?: boolean } = {}): SiteDoc {
  const site = starterSite();
  site.layout = structuredClone(layout);
  site.collections[BLOG] = {
    id: BLOG,
    preset: "blog",
    name: "Blog",
    folder: "blog",
    fields: [],
    design: { before: [title], after: [back] },
  };
  site.pages[POST] = {
    id: POST,
    kind: "page",
    slug: "spring",
    folder: "blog",
    title: "Spring",
    collection: BLOG,
    settings: { hideHeader: false, hideFooter: false, hideFromNavigation: false, ...settings },
    doc: { root: { props: {} }, content: [] },
  };
  site.pageOrder.push(POST);
  return site;
}

/** `site` as `recipe` changes it, in one step of a history, which shares what it leaves alone. */
function produce(site: SiteDoc, recipe: (draft: SiteDoc) => void): SiteDoc {
  const history = createHistoryManager({ initial: site });
  history.run("Edited", recipe);
  return history.document.getState();
}

describe("canvasLayout (6.10a)", () => {
  it("is the shown layout on a page that isn't a post", () => {
    const site = siteWithPost();

    expect(canvasLayout(site, site.homePageId)).toBe(site.layout);
  });

  it("draws a post's design inside the Header and Footer, as the same object each time", () => {
    const site = siteWithPost();
    const drawn = canvasLayout(site, POST);

    expect(drawn).toEqual({
      header: [...layout.header, title],
      footer: [back, ...layout.footer],
    });
    expect(canvasLayout(site, POST)).toBe(drawn);
  });

  it("draws the design where the post hides the Header and Footer", () => {
    const site = siteWithPost({ hideHeader: true, hideFooter: true });

    expect(canvasLayout(site, POST)).toEqual({ header: [title], footer: [back] });
  });
});

describe("sharedHomeOf (6.10a)", () => {
  it("finds a design's element in its collection, and the Header's in the Header", () => {
    const site = siteWithPost();

    expect(sharedHomeOf(site, POST, "post-title")).toEqual({ collection: BLOG, part: "before" });
    expect(sharedHomeOf(site, POST, "back")).toEqual({ collection: BLOG, part: "after" });
    expect(sharedHomeOf(site, POST, "logo")).toBe("header");
    expect(sharedHomeOf(site, site.homePageId, "post-title")).toBeUndefined();
  });
});

describe("syncCanvasLayout (6.10a)", () => {
  it("writes the design's elements to the collection and the Header's to the layout", () => {
    const site = siteWithPost();
    const drawn = structuredClone(canvasLayout(site, POST));
    if (drawn.header[1] !== undefined) drawn.header[1].props.text = "Heading";
    if (drawn.footer[1] !== undefined) drawn.footer[1].props.text = "Goodbye";

    const next = produce(site, (draft) => syncCanvasLayout(draft, site, POST, drawn, syncDraft));

    expect(next.collections[BLOG]?.design.before[0]?.props.text).toBe("Heading");
    expect(next.layout.footer[0]?.props.text).toBe("Goodbye");
    expect(next.layout.header).toBe(site.layout.header);
    expect(next.collections[BLOG]?.design.after).toBe(site.collections[BLOG]?.design.after);
  });

  it("leaves a Header the post hides as it is", () => {
    const site = siteWithPost({ hideHeader: true });
    const drawn = structuredClone(canvasLayout(site, POST));
    if (drawn.header[0] !== undefined) drawn.header[0].props.text = "Heading";

    const next = produce(site, (draft) => syncCanvasLayout(draft, site, POST, drawn, syncDraft));

    expect(next.collections[BLOG]?.design.before[0]?.props.text).toBe("Heading");
    expect(next.layout.header).toBe(site.layout.header);
  });
});

describe("updateSharedField", () => {
  it("sets a field of a shared element, at any depth", () => {
    const site = siteWithPost();
    const next = produce(site, (draft) => {
      expect(updateSharedField(draft, site, "header", "logo", "text", () => "Hello")).toBe(true);
      expect(updateSharedField(draft, site, "footer", "logo", "text", () => "No")).toBe(false);
    });

    expect(next.layout.header[0]?.props.content).toEqual([
      { type: "Heading", props: { id: "logo", text: "Hello" } },
    ]);
    expect(next.layout.footer).toEqual(layout.footer);
  });

  it("sets a field of a design's element in its collection (6.10a)", () => {
    const site = siteWithPost();
    const home = { collection: BLOG, part: "after" } as const;
    const next = produce(site, (draft) => {
      expect(updateSharedField(draft, site, home, "back", "text", () => "All posts")).toBe(true);
    });

    expect(next.collections[BLOG]?.design.after[0]?.props.text).toBe("All posts");
  });
});
