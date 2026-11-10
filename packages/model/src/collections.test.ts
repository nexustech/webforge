import { describe, expect, it } from "vitest";
import { itemBindingOf, validBindings } from "./bindings.js";
import {
  type Collection,
  collectionItems,
  collectionSchema,
  freeCollectionFolder,
  itemValue,
  itemValues,
  newCollection,
} from "./collections.js";
import type { NodeDoc } from "./documents.js";
import type { CollectionId, MediaId, PageId } from "./ids.js";
import { syncMenuWithPages } from "./menu-sync.js";
import { createSite, type PageEntry, type SiteDoc, siteDocSchema } from "./site-doc.js";
import { siteSnapshotSchema } from "./site-snapshot.js";
import { siteToSnapshot } from "./to-snapshot.js";

const BLOG = "blog000000000000" as CollectionId;

const title: NodeDoc = {
  type: "Heading",
  props: { id: "post-title", text: "Title", bindings: { text: "item.title" } },
};
const more: NodeDoc = { type: "Text", props: { id: "post-more", text: "More soon" } };

function blog(overrides: Partial<Collection> = {}): Collection {
  return {
    ...newCollection({
      id: BLOG,
      preset: "blog",
      name: "Blog",
      folder: "blog",
      labels: { date: "Date", summary: "Summary", picture: "Picture" },
      design: { before: [title], after: [more] },
    }),
    ...overrides,
  };
}

/** A post of the Blog, `slug` in its folder. */
function post(id: string, slug: string, entry?: Record<string, string>): PageEntry {
  return {
    id: id as PageId,
    kind: "page",
    slug,
    folder: "blog",
    title: `Post ${slug}`,
    collection: BLOG,
    ...(entry === undefined ? {} : { entry }),
    settings: { hideHeader: false, hideFooter: false, hideFromNavigation: false },
    doc: {
      root: { props: {} },
      content: [{ type: "Text", props: { id: `${id}-text`, text: "Body" } }],
    },
  };
}

/** A new site with the Blog and `posts`, before "Page not found". */
function siteWith(...posts: PageEntry[]): SiteDoc {
  const site = createSite({
    name: "Rosa's Bakery",
    language: "en-GB",
    homeTitle: "Home",
    notFoundTitle: "Page not found",
  });
  site.collections[BLOG] = blog();
  for (const each of posts) {
    site.pages[each.id] = each;
    site.pageOrder.splice(site.pageOrder.length - 1, 0, each.id);
  }
  return site;
}

function issuesOf(site: unknown): string[] {
  const result = siteDocSchema.safeParse(site);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("newCollection (6.10a)", () => {
  it("gives the Blog a date, a summary and a picture, labelled as the caller says", () => {
    const made = blog();

    expect(made.fields).toEqual([
      { name: "date", label: "Date", kind: "date" },
      { name: "summary", label: "Summary", kind: "text" },
      { name: "picture", label: "Picture", kind: "image" },
    ]);
    expect(collectionSchema.safeParse(made).success).toBe(true);
  });

  it("refuses a field named title, a field twice, and the 'assets' folder", () => {
    const date = { name: "date", label: "Date", kind: "date" } as const;
    expect(collectionSchema.safeParse(blog({ fields: [{ ...date, name: "title" }] })).success).toBe(
      false,
    );
    expect(collectionSchema.safeParse(blog({ fields: [date, date] })).success).toBe(false);
    expect(collectionSchema.safeParse(blog({ folder: "assets" })).success).toBe(false);
    expect(collectionSchema.safeParse(blog({ folder: "blog/news" })).success).toBe(false);
  });
});

describe("itemValue (6.10a)", () => {
  const collection = blog();

  it("reads the title and each field for its kind", () => {
    const page = post("p1", "spring", {
      date: "2026-11-10",
      summary: "Doors open at nine",
      picture: "hero000000000000",
    });

    expect(itemValues(collection, page)).toEqual({
      title: { kind: "text", text: "Post spring" },
      date: { kind: "date", date: "2026-11-10" },
      summary: { kind: "text", text: "Doors open at nine" },
      picture: { kind: "image", mediaId: "hero000000000000" as MediaId },
    });
  });

  it("reads a value that doesn't fit its field, an empty one or an unknown field as empty", () => {
    const page = post("p1", "spring", {
      date: "2026-02-30",
      summary: "   ",
      picture: "__proto__",
      colour: "red",
    });

    expect(itemValues(collection, page)).toEqual({ title: { kind: "text", text: "Post spring" } });
    expect(itemValue(collection, page, "colour")).toBeUndefined();
    expect(itemValue(collection, page, "toString")).toBeUndefined();
    expect(itemValue(collection, { title: "  " }, "title")).toBeUndefined();
  });
});

describe("collectionItems (6.10a)", () => {
  it("lists a collection's items newest first, those without a date last, in page order", () => {
    const site = siteWith(
      post("p1", "one", { date: "2026-01-05" }),
      post("p2", "two"),
      post("p3", "three", { date: "2026-03-01" }),
      post("p4", "four", { date: "not a day" }),
      post("p5", "five", { date: "2026-01-05" }),
    );

    expect(collectionItems(site, BLOG).map((page) => page.id)).toEqual([
      "p3",
      "p1",
      "p5",
      "p2",
      "p4",
    ]);
    expect(collectionItems(site, "nothing" as CollectionId)).toEqual([]);
  });
});

describe("freeCollectionFolder (6.10a)", () => {
  it("gives the folder asked for, or the next one no collection has", () => {
    const site = siteWith();

    expect(freeCollectionFolder({ collections: {} }, "blog")).toBe("blog");
    expect(freeCollectionFolder(site, "blog")).toBe("blog-2");
    site.collections["b2" as CollectionId] = blog({ id: "b2" as CollectionId, folder: "blog-2" });
    expect(freeCollectionFolder(site, "blog")).toBe("blog-3");
  });
});

describe("a site's collections and items (6.10a, ADR 0025)", () => {
  it("accepts a Blog and its posts, and keeps them through a JSON round trip", () => {
    const site = siteWith(post("p1", "spring", { date: "2026-11-10" }));

    expect(issuesOf(site)).toEqual([]);
    expect(siteDocSchema.parse(JSON.parse(JSON.stringify(site)))).toEqual(site);
  });

  it("refuses an item of a missing collection, or outside its collection's folder", () => {
    const missing = siteWith(post("p1", "spring"));
    missing.collections = {};
    const elsewhere = siteWith({ ...post("p1", "spring"), folder: "news" });
    const atTop = siteWith(post("p1", "spring"));
    delete atTop.pages["p1" as PageId]?.folder;

    expect(issuesOf(missing)).toEqual([`The collection "${BLOG}" is missing`]);
    expect(issuesOf(elsewhere)).toEqual(["An item is in its collection's folder"]);
    expect(issuesOf(atTop)).toEqual(["An item is in its collection's folder"]);
  });

  it("refuses field values on a page that isn't an item", () => {
    const site = siteWith();
    const home = site.pages[site.homePageId];
    if (home !== undefined) home.entry = { date: "2026-11-10" };

    expect(issuesOf(site)).toEqual(["Only a collection's item has field values"]);
  });

  it("never makes the home page or 'Page not found' an item", () => {
    const site = siteWith();
    for (const page of Object.values(site.pages)) {
      page.collection = BLOG;
    }

    expect(issuesOf(site)).toContain("The home page and the 'Page not found' page are never items");
  });

  it("refuses collections sharing a folder, or stored under another id", () => {
    const shared = siteWith();
    shared.collections["b2" as CollectionId] = blog({ id: "b2" as CollectionId });
    const misfiled = siteWith();
    misfiled.collections["other" as CollectionId] = blog();
    delete misfiled.collections[BLOG];

    expect(issuesOf(shared)).toEqual(["Collections share a folder: blog"]);
    expect(issuesOf(misfiled)).toEqual([`Collection "other" has the id "${BLOG}"`]);
  });

  it("refuses a copy of a shared section in a design", () => {
    const site = siteWith();
    site.collections[BLOG] = blog({
      design: {
        before: [{ type: "SharedSectionCopy", props: { id: "c", sharedSectionId: "s" } }],
        after: [],
      },
    });

    expect(issuesOf(site)).toContain("A collection's design can't hold a copy of a shared section");
  });
});

describe("item bindings (6.10a)", () => {
  it("keeps an item binding beside Site Settings ones, and names its field", () => {
    const bindings = { text: "item.title", phone: "contact.phone", bad: "item.", odd: "items.x" };

    expect(validBindings(bindings)).toEqual({ text: "item.title", phone: "contact.phone" });
    expect(itemBindingOf(bindings, "text")).toBe("title");
    expect(itemBindingOf(bindings, "phone")).toBeUndefined();
    expect(itemBindingOf(bindings, "toString")).toBeUndefined();
  });
});

describe("siteToSnapshot with a Blog (6.10a)", () => {
  it("draws the design around each post, with its values, and keeps posts out of the menu", () => {
    const site = siteWith(
      post("p1", "spring", { date: "2026-11-10", picture: "hero000000000000" }),
    );
    const snapshot = siteToSnapshot(site, new Map());
    const page = snapshot.pages.find((each) => each.id === "p1");

    expect(page?.path).toBe("blog/spring");
    expect(page?.hideFromNavigation).toBe(true);
    expect(page?.doc.content.map((node) => node.props.id)).toEqual([
      "post-title",
      "p1-text",
      "post-more",
    ]);
    expect(page?.item?.values).toEqual({
      title: { kind: "text", text: "Post spring" },
      date: { kind: "date", date: "2026-11-10" },
      picture: { kind: "image", mediaId: "hero000000000000" },
    });
    expect(snapshot.pages.find((each) => each.id === site.homePageId)?.item).toBeUndefined();
    expect(siteSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });
});

describe("syncMenuWithPages with a Blog (6.10a)", () => {
  it("leaves posts out of a menu that follows the pages, and out of an edited one's additions", () => {
    const site = siteWith(post("p1", "spring"));
    const following = syncMenuWithPages(site, "p1" as PageId);

    expect(following.items.map((item) => item.kind === "page" && item.pageId)).toEqual([
      site.homePageId,
    ]);
    const edited = syncMenuWithPages(
      { ...site, menu: { ...following, follows: "custom" } },
      "p1" as PageId,
    );
    expect(edited.items).toHaveLength(1);
  });
});
