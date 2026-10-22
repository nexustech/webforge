import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { siteDocArbitrary } from "../test/arbitraries.js";
import type { NodeDoc } from "./documents.js";
import type { PageId } from "./ids.js";
import { SHARED_COPY_TYPE } from "./shared-sections.js";
import {
  createSite,
  type PageEntry,
  pagePath,
  SITE_FORMAT_VERSION,
  type SiteDoc,
  siteDocSchema,
} from "./site-doc.js";

const options = {
  name: "Rosa's Bakery",
  language: "en-GB",
  homeTitle: "Home",
  notFoundTitle: "Page not found",
};

function issuesOf(site: unknown): string[] {
  const result = siteDocSchema.safeParse(site);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

function withPage(site: SiteDoc, page: Omit<Partial<PageEntry>, "id"> & { id: string }): SiteDoc {
  const entry: PageEntry = {
    kind: "page",
    slug: "about",
    title: "About",
    settings: { hideHeader: false, hideFooter: false, hideFromNavigation: false },
    doc: { root: { props: {} }, content: [] },
    ...page,
    id: page.id as PageId,
  };
  return {
    ...site,
    pages: { ...site.pages, [entry.id]: entry },
    pageOrder: [...site.pageOrder, entry.id],
  };
}

describe("createSite", () => {
  it("makes a valid site with a home page, a 'Page not found' page and a menu", () => {
    const site = createSite(options);

    expect(siteDocSchema.parse(site)).toEqual(site);
    expect(site.pageOrder).toHaveLength(2);
    const [home, notFound] = site.pageOrder.map((id) => site.pages[id]);
    expect(home).toMatchObject({ id: site.homePageId, kind: "page", title: "Home" });
    expect(notFound).toMatchObject({ kind: "not-found", title: "Page not found" });
    expect(notFound?.settings.hideFromNavigation).toBe(true);
    expect(site.menu).toEqual({
      follows: "pages",
      items: [{ id: expect.any(String), kind: "page", pageId: site.homePageId, hidden: false }],
    });
    expect(site.settings.general).toEqual({ name: "Rosa's Bakery", language: "en-GB" });
  });

  it("uses the given content, layout and theme", () => {
    const homeDoc = {
      root: { props: {} },
      content: [{ type: "Heading", props: { id: "h", text: "Hi" } }],
    };
    const layout = { header: [{ type: "Header", props: { id: "header" } }], footer: [] };

    const site = createSite({ ...options, homeDoc, layout, theme: "cupcake" });

    expect(site.pages[site.homePageId]?.doc).toBe(homeDoc);
    expect(site.layout).toBe(layout);
    expect(site.theme).toEqual({ name: "cupcake" });
  });

  it("gives every new site its own ids", () => {
    expect(createSite(options).homePageId).not.toBe(createSite(options).homePageId);
  });
});

describe("pagePath", () => {
  const site = createSite(options);
  const home = site.pages[site.homePageId] as PageEntry;
  const notFound = Object.values(site.pages).find((page) => page.kind === "not-found") as PageEntry;

  it("exports the home page as index and the 'Page not found' page as 404", () => {
    expect(pagePath(home, site.homePageId)).toBe("index");
    expect(pagePath(notFound, site.homePageId)).toBe("404");
  });

  it("joins the folder and the slug", () => {
    const page = { ...home, id: "other" as PageId, slug: "cakes" };

    expect(pagePath(page, site.homePageId)).toBe("cakes");
    expect(pagePath({ ...page, folder: "services/baking" }, site.homePageId)).toBe(
      "services/baking/cakes",
    );
  });
});

describe("siteDocSchema", () => {
  const site = createSite(options);

  it("survives a JSON round trip unchanged (parse ∘ serialise)", () => {
    fc.assert(
      fc.property(siteDocArbitrary, (doc) => {
        expect(issuesOf(doc)).toEqual([]);
        expect(siteDocSchema.parse(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
      }),
      { numRuns: 100 },
    );
  }, 30_000);

  it("rejects copies of shared sections that aren't valid, or aren't at the top of a page", () => {
    const copy = (props: Record<string, unknown>): NodeDoc => ({
      type: SHARED_COPY_TYPE,
      props: { id: "c", sharedSectionId: "shared-hours", ...props },
    });
    const page = (content: NodeDoc[]) =>
      issuesOf(withPage(site, { id: "page-about", doc: { root: { props: {} }, content } }));

    expect(page([copy({}), copy({ id: "d", anchorSuffix: "2" })])).toEqual([]);
    // Its suffix goes into HTML ids: digits only.
    expect(page([copy({ anchorSuffix: "2 onclick" })])).toContain(
      "Not a valid copy of a shared section",
    );
    expect(page([copy({ sharedSectionId: "not an id" })])).toContain(
      "Not a valid copy of a shared section",
    );
    // Only a page's top level is shown as the shared section; deeper, it would be an unknown element.
    expect(page([{ type: "Section", props: { id: "s", content: [copy({})] } }])).toContain(
      "A copy of a shared section can only be at the top of a page",
    );
    // Two copies with one suffix would give the page two elements with one anchor.
    expect(page([copy({}), copy({ id: "d" })])).toContain(
      "Two copies of a shared section have the same anchors",
    );
  });

  it("rejects a copy of a shared section in the Header or Footer", () => {
    const copy: NodeDoc = {
      type: SHARED_COPY_TYPE,
      props: { id: "c", sharedSectionId: "shared-hours" },
    };

    expect(issuesOf({ ...site, layout: { ...site.layout, footer: [copy] } })).toContain(
      "The Header and Footer can't hold a copy of a shared section",
    );
  });

  it("rejects a page stored under another id", () => {
    const page = site.pages[site.homePageId] as PageEntry;
    const broken = { ...site, pages: { ...site.pages, other: page } };

    expect(issuesOf(broken)).toContain(`Page "other" has the id "${site.homePageId}"`);
  });

  it.each(["index", "404", "assets"])(
    "rejects the reserved slug %s on an ordinary page",
    (slug) => {
      expect(issuesOf(withPage(site, { id: "about", slug }))).toContain(
        `The slug "${slug}" is reserved`,
      );
    },
  );

  it.each(["About", "about us", "about.html", "a--b", "-a", "a/b", ""])(
    "rejects the slug %j",
    (slug) => {
      expect(siteDocSchema.safeParse(withPage(site, { id: "about", slug })).success).toBe(false);
    },
  );

  it("rejects pages in the 'assets' folder", () => {
    expect(issuesOf(withPage(site, { id: "about", folder: "assets/img" }))).toContain(
      "The folder 'assets' is reserved",
    );
  });

  it("rejects a home page in a folder", () => {
    const home = site.pages[site.homePageId] as PageEntry;
    const broken = { ...site, pages: { ...site.pages, [home.id]: { ...home, folder: "x" } } };

    expect(issuesOf(broken)).toContain(
      "The home page and the 'Page not found' page can't be in a folder",
    );
  });

  it("rejects a page order that misses or repeats a page", () => {
    const [first] = site.pageOrder;
    expect(issuesOf({ ...site, pageOrder: [first] })).toContain(
      "pageOrder must list every page exactly once",
    );
    expect(issuesOf({ ...site, pageOrder: [first, first] })).toContain(
      "pageOrder must list every page exactly once",
    );
  });

  it("rejects a missing home page, or a 'Page not found' page as home", () => {
    expect(issuesOf({ ...site, homePageId: "gone" })).toContain("The home page is missing");
    const notFound = site.pageOrder[1];
    expect(issuesOf({ ...site, homePageId: notFound })).toContain("The home page is missing");
  });

  it("needs exactly one 'Page not found' page", () => {
    const twice = withPage(site, { id: "lost", kind: "not-found", slug: "lost" });
    expect(issuesOf(twice)).toContain("The site needs exactly one 'Page not found' page");
  });

  it("rejects two pages with the same path", () => {
    const one = withPage(site, { id: "a", slug: "cakes", folder: "services" });
    const two = withPage(one, { id: "b", slug: "cakes", folder: "services" });

    expect(issuesOf(two)).toContain("Duplicate page paths: services/cakes");
  });

  it("rejects media stored under another id, and two media items with one name", () => {
    const image = {
      id: "a",
      kind: "image",
      hash: "0".repeat(64),
      name: "hero",
      fileName: "hero.jpg",
      mimeType: "image/jpeg",
      width: 10,
      height: 10,
      alt: "",
    };
    const issues = issuesOf({ ...site, media: { a: image, b: image } });

    expect(issues).toContain('Media "b" has the id "a"');
    expect(issues).toContain("Duplicate media names: hero");
  });

  it("rejects duplicate menu item ids, also inside a dropdown", () => {
    const item = { id: "m1", kind: "page", pageId: site.homePageId, hidden: false };
    const group = { id: "g", kind: "group", label: "More", hidden: false, children: [item] };

    expect(issuesOf({ ...site, menu: { follows: "custom", items: [item, group] } })).toContain(
      "Duplicate menu item ids: m1",
    );
  });

  it("rejects ids that are unsafe as object keys", () => {
    const page = site.pages[site.homePageId] as PageEntry;
    const broken = JSON.parse(
      JSON.stringify({ ...site, pageOrder: ["__proto__"], homePageId: "__proto__" }),
    );
    broken.pages = { ["__proto__"]: { ...page, id: "__proto__" } };

    expect(siteDocSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects another format version and unknown keys", () => {
    expect(
      siteDocSchema.safeParse({ ...site, formatVersion: SITE_FORMAT_VERSION + 1 }).success,
    ).toBe(false);
    expect(
      siteDocSchema.safeParse({ ...site, formatVersion: SITE_FORMAT_VERSION - 1 }).success,
    ).toBe(false);
    expect(siteDocSchema.safeParse({ ...site, extra: true }).success).toBe(false);
  });
});

describe("unsafe keys anywhere in a site (#138)", () => {
  /** The site as a crafted file would hold it: `edit` changes its JSON text. */
  const crafted = (edit: (json: string) => string): unknown =>
    JSON.parse(edit(JSON.stringify(createSite(options))));

  it("refuses __proto__ as a media or page id, and unsafe keys in settings", () => {
    const cases = [
      crafted((json) => json.replace('"media":{}', '"media":{"__proto__":{"polluted":true}}')),
      crafted((json) => json.replace('"pages":{', '"pages":{"__proto__":{},')),
      crafted((json) => json.replace('"settings":{', '"settings":{"constructor":{},')),
    ];

    for (const site of cases) {
      expect(issuesOf(site)).toEqual([expect.stringMatching(/^Documents may not contain a "/)]);
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    // The untouched site still passes.
    expect(issuesOf(crafted((json) => json))).toEqual([]);
  });
});
