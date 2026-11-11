import { describe, expect, it } from "vitest";
import { itemBindingOf, validBindings } from "./bindings.js";
import { findBrokenLinks } from "./broken-links.js";
import {
  type Collection,
  collectionItems,
  collectionOf,
  collectionSchema,
  freeCollectionFolder,
  itemValue,
  itemValues,
  listPath,
  newCollection,
  tagNames,
  tagPath,
  tagSlug,
} from "./collections.js";
import type { NodeDoc } from "./documents.js";
import type { CollectionId, MediaId, MenuItemId, PageId } from "./ids.js";
import { syncMenuWithPages } from "./menu-sync.js";
import { rewriteRichTextLinks, richTextHref, richTextLinkValue } from "./rich-text-links.js";
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
      labels: { date: "Date", summary: "Summary", picture: "Picture", tags: "Tags" },
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
  it("gives the Blog a date, a summary, a picture and tags, labelled as the caller says", () => {
    const made = blog();

    expect(made.fields).toEqual([
      { name: "date", label: "Date", kind: "date" },
      { name: "summary", label: "Summary", kind: "text" },
      { name: "picture", label: "Picture", kind: "image" },
      { name: "tags", label: "Tags", kind: "tags" },
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

  it("skips ordinary pages' folders and `assets`, but not the collection's own (#937)", () => {
    const site = siteWith(post("p1", "spring"));
    const own = BLOG;
    const pages = {
      ...site.pages,
      n1: { folder: "news/local" },
      n2: { folder: "news-2" },
    };

    expect(freeCollectionFolder({ ...site, pages }, "news")).toBe("news-3");
    expect(freeCollectionFolder({ ...site, pages }, "assets")).toBe("assets-2");
    expect(freeCollectionFolder({ ...site, pages }, "con")).toBe("con-2");
    expect(freeCollectionFolder({ ...site, pages }, "blog", own)).toBe("blog");
    expect(freeCollectionFolder({ ...site, pages }, "blog")).toBe("blog-2");
    // Never longer than a folder can be.
    expect(freeCollectionFolder({ collections: {} }, "a".repeat(90))).toHaveLength(80);
  });

  it("skips the folders another collection was in, but not the collection's own (#942)", () => {
    const site = siteWith();
    const blogDoc = site.collections[BLOG];
    if (blogDoc === undefined) throw new Error("no blog");
    blogDoc.formerFolders = ["journal"];

    expect(freeCollectionFolder(site, "journal")).toBe("journal-2");
    expect(freeCollectionFolder(site, "journal", BLOG)).toBe("journal");
    expect(issuesOf(site)).toEqual([]);
    expect(siteToSnapshot(site, new Map()).collections?.[0]?.formerFolders).toEqual(["journal"]);
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
    // Out of the menu by the menu's own sync, not by hiding: an edited menu may list it.
    expect(page?.hideFromNavigation).toBe(false);
    expect(snapshot.menu?.items.some((item) => item.kind === "page" && item.pageId === "p1")).toBe(
      false,
    );
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

    // The home page, then the Blog's list (#940): never the post itself.
    expect(following.items.map((item) => (item.kind === "page" ? item.pageId : item.kind))).toEqual(
      [site.homePageId, "link"],
    );
    const edited = syncMenuWithPages(
      { ...site, menu: { ...following, follows: "custom" } },
      "p1" as PageId,
    );
    expect(edited.items).toHaveLength(2);
  });

  it("lists each Blog's list after the pages, by its name, keeping its item (#940)", () => {
    const site = siteWith();
    const first = syncMenuWithPages(site);
    const [, list] = first.items;

    expect(list).toMatchObject({
      kind: "link",
      label: "Blog",
      link: { kind: "list", collectionId: BLOG },
      hidden: false,
    });
    // Renamed and hidden, it keeps its id and hidden state, and shows the new name.
    const renamed = {
      ...site,
      menu: {
        ...first,
        items: first.items.map((item) => (item === list ? { ...item, hidden: true } : item)),
      },
      collections: { [BLOG]: blog({ name: "News" }) },
    };
    expect(syncMenuWithPages(renamed).items[1]).toEqual({ ...list, hidden: true, label: "News" });
    // Without the Blog, its item goes.
    expect(syncMenuWithPages({ ...site, collections: {} }).items).toHaveLength(1);
  });

  it("adds a Blog's list to an edited menu once, and drops it when the Blog is gone (#940)", () => {
    const site = siteWith();
    const custom = { ...site, menu: { follows: "custom" as const, items: [] } };

    const added = syncMenuWithPages(custom, undefined, BLOG);
    expect(added.items.map((item) => item.kind === "link" && item.link)).toEqual([
      { kind: "list", collectionId: BLOG },
    ]);
    expect(syncMenuWithPages({ ...custom, menu: added }, undefined, BLOG).items).toHaveLength(1);
    expect(syncMenuWithPages({ ...custom, menu: added, collections: {} }).items).toEqual([]);
  });
});

describe("collections read by own key (6.10a)", () => {
  it("never takes what every object has for a collection", () => {
    const site = siteWith();
    const page = { ...post("p1", "spring"), collection: "constructor" as CollectionId };
    delete page.folder;
    site.pages[page.id] = page;
    site.pageOrder.splice(1, 0, page.id);

    expect(collectionOf(site, page)).toBeUndefined();
    expect(collectionItems(site, "constructor" as CollectionId)).toEqual([]);
    expect(issuesOf(site)).toEqual([`The collection "constructor" is missing`]);
    expect(() => siteToSnapshot(site, new Map())).not.toThrow();
  });
});

describe("tags (6.10b)", () => {
  it("reads tags typed with commas, each page once, with its page in the Blog's folder", () => {
    const page = post("p1", "spring", { tags: " Opening times, news,,NEWS , Café  latte, con " });

    expect(itemValue(blog(), page, "tags")).toEqual({
      kind: "tags",
      tags: [
        { name: "Opening times", path: "blog/tag/opening-times" },
        { name: "news", path: "blog/tag/news" },
        { name: "Café latte", path: "blog/tag/cafe-latte" },
        // A name Windows keeps for a device gets a file it can write.
        { name: "con", path: "blog/tag/con-tag" },
      ],
    });
    expect(itemValue(blog(), post("p2", "x", { tags: " , !!! ," }), "tags")).toBeUndefined();
  });

  it("keeps tags in any script, each its own page, the same every time (#939 review)", () => {
    const names = ["Νέα", "Προσφορές", "Новости", "新闻", "Café Νέα", "Café", "νέα"];
    const tags = itemValue(blog(), post("p1", "x", { tags: names.join(", ") }), "tags");
    const paths = tags?.kind === "tags" ? tags.tags.map((tag) => tag.path) : [];

    // "νέα" is "Νέα" in another case: one tag, its first spelling.
    expect(tags?.kind === "tags" ? tags.tags.map((tag) => tag.name) : []).toEqual(
      names.slice(0, 6),
    );
    expect(new Set(paths).size).toBe(6);
    expect(paths[5]).toBe("blog/tag/cafe");
    for (const path of paths.slice(0, 5)) expect(path).toMatch(/^blog\/tag\/tag-[0-9a-z]+$/);
    expect(tagSlug("Νέα")).toBe(tagSlug(" νέα "));
  });

  it("keeps at most 20 tags, and gives each a name that makes a file", () => {
    const many = Array.from({ length: 25 }, (_, n) => `tag ${n}`).join(",");

    expect(tagNames(many)).toHaveLength(20);
    expect(tagSlug("Ünïcode & More")).toBe("unicode-more");
    expect(tagPath("news", "Big Day")).toBe("news/tag/big-day");
  });
});

describe("a Blog's own pages (6.10b)", () => {
  it("lists every post in the snapshot, newest first, with its fields", () => {
    const site = siteWith(
      post("p1", "older", { date: "2026-01-05", tags: "News" }),
      post("p2", "newer", { date: "2026-03-01" }),
    );
    const [blogList] = siteToSnapshot(site, new Map()).collections ?? [];

    expect(blogList).toMatchObject({ id: BLOG, name: "Blog", folder: "blog" });
    expect(blogList?.items.map((item) => [item.pageId, item.path])).toEqual([
      ["p2", "blog/newer"],
      ["p1", "blog/older"],
    ]);
    expect(blogList?.items[1]?.values.tags).toEqual({
      kind: "tags",
      tags: [{ name: "News", path: "blog/tag/news" }],
    });
    expect(
      siteToSnapshot(
        createSite({ name: "x", language: "en", homeTitle: "Home", notFoundTitle: "?" }),
        new Map(),
      ).collections,
    ).toBeUndefined();
  });

  it("keeps pages out of the folders the export writes the Blog's pages to", () => {
    const site = siteWith();
    const home = site.pages[site.homePageId];
    if (home === undefined) throw new Error("no home");
    site.pages["x" as PageId] = { ...home, id: "x" as PageId, slug: "x", folder: "blog/tag" };
    site.pageOrder.push("x" as PageId);

    expect(issuesOf(site)).toEqual(["A page can't be in a Blog's own folders"]);
    expect(listPath("blog")).toBe("blog/index");
    expect(listPath("blog", 3)).toBe("blog/page/3");
  });
});

describe("links to a Blog's list (#940)", () => {
  it("are kept in rich text as webforge:list/, read back, and written where the export says", () => {
    const link = { kind: "list", collectionId: BLOG } as const;
    const href = richTextHref(link);

    expect(href).toBe(`webforge:list/${BLOG}`);
    expect(richTextLinkValue({ href, newTab: true })).toEqual({ ...link, newTab: true });
    expect(
      rewriteRichTextLinks(`<a href="${href}">All posts</a>`, (each) =>
        each.kind === "list" ? `../blog/index.html` : "#",
      ),
    ).toBe('<a href="../blog/index.html">All posts</a>');
  });

  it("are broken once the Blog is gone, in the menu, a link field or rich text", () => {
    const site = siteWith();
    site.menu = {
      follows: "custom",
      items: [
        {
          id: "m1" as MenuItemId,
          kind: "link",
          label: "Blog",
          link: { kind: "list", collectionId: BLOG },
          hidden: false,
        },
      ],
    };
    const home = site.pages[site.homePageId];
    if (home === undefined) throw new Error("no home");
    home.doc.content = [
      { type: "Button", props: { id: "b", link: { kind: "list", collectionId: BLOG } } },
      { type: "Text", props: { id: "t", text: `<p><a href="webforge:list/${BLOG}">x</a></p>` } },
    ];

    expect(findBrokenLinks(site)).toEqual([]);
    site.collections = {};
    expect(findBrokenLinks(site)).toEqual([
      { on: "menu", nodeId: "m1", collectionId: BLOG },
      { on: site.homePageId, nodeId: "b", collectionId: BLOG },
      { on: site.homePageId, nodeId: "t", collectionId: BLOG },
    ]);
  });
});
