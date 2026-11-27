import { describe, expect, it } from "vitest";
import type { NodeDoc } from "./documents.js";
import type { CollectionId, SharedSectionId } from "./ids.js";
import { createSite, type SiteDoc } from "./site-doc.js";
import {
  designAt,
  eachElement,
  elementsAt,
  pageWithCopy,
  unpublishedRoots,
} from "./site-elements.js";

const HOURS = "shared-hours" as SharedSectionId;
const BLOG = "blog" as CollectionId;

const node = (id: string, props: Record<string, unknown> = {}): NodeDoc => ({
  type: "Section",
  props: { id, ...props },
});

/** A site with an element in each place, a hidden one, and elements in slots. */
function site() {
  const base = createSite({
    name: "Bakery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Not found",
    layout: { header: [node("header")], footer: [node("footer")] },
    homeDoc: {
      root: { props: {} },
      content: [
        node("outer", {
          content: [node("inner"), node("hidden", { hidden: true, content: [node("under")] })],
        }),
      ],
    },
  });
  return {
    ...base,
    sharedSections: { [HOURS]: { id: HOURS, name: "Hours", section: node("shared") } },
    collections: {
      [BLOG]: {
        id: BLOG,
        preset: "blog" as const,
        name: "Blog",
        folder: "blog",
        fields: [],
        design: {
          before: [node("design-top", { content: [node("design-title")] })],
          after: [node("design-bottom")],
        },
      },
    },
  };
}

describe("eachElement", () => {
  it("visits the Header, the Footer, each page, each shared section and each design once, slots after their element", () => {
    const visited: string[] = [];
    const doc = site();
    eachElement(doc, (each, on) => visited.push(`${on}:${each.props.id}`));

    const home = doc.homePageId;
    expect(visited).toEqual([
      "header:header",
      "footer:footer",
      `${home}:outer`,
      `${home}:inner`,
      `${home}:hidden`,
      `${home}:under`,
      `${HOURS}:shared`,
      // The Blog's design once (#936), not once for each post: above each post, then below.
      `${BLOG}:design-top`,
      `${BLOG}:design-title`,
      `${BLOG}:design-bottom`,
    ]);
  });

  it("leaves out hidden elements and what they hold, as the export does, when asked", () => {
    const visited: string[] = [];
    eachElement(site(), (each) => visited.push(each.props.id), { skipHidden: true });

    expect(visited).toEqual([
      "header",
      "footer",
      "outer",
      "inner",
      "shared",
      "design-top",
      "design-title",
      "design-bottom",
    ]);
  });
});

describe("elementsAt (#936)", () => {
  it("gives the top-level elements kept at each place, and none at a place there isn't", () => {
    const doc = site();
    const ids = (on: string) => elementsAt(doc, on).map((each) => each.props.id);

    expect(ids("header")).toEqual(["header"]);
    expect(ids("footer")).toEqual(["footer"]);
    expect(ids(doc.homePageId)).toEqual(["outer"]);
    expect(ids(HOURS)).toEqual(["shared"]);
    expect(ids(BLOG)).toEqual(["design-top", "design-bottom"]);
    expect(ids("constructor")).toEqual([]);
    expect(designAt(doc, BLOG)?.name).toBe("Blog");
    expect(designAt(doc, HOURS)).toBeUndefined();
  });
});

describe("pageWithCopy (#988)", () => {
  it("finds a page with a copy of the shared section: the shown page first, then in order", () => {
    const base = site();
    const copy = (id: string): NodeDoc => ({
      type: "SharedSectionCopy",
      props: { id, sharedSectionId: HOURS },
    });
    const [home, notFound] = base.pageOrder;
    if (home === undefined || notFound === undefined) throw new Error("No pages");
    const homePage = base.pages[home];
    const notFoundPage = base.pages[notFound];
    if (homePage === undefined || notFoundPage === undefined) throw new Error("No pages");
    homePage.doc.content.push(copy("on-home"));
    notFoundPage.doc.content.push(copy("on-not-found"));

    expect(pageWithCopy(base, HOURS, notFound)).toEqual({
      pageId: notFound,
      copyId: "on-not-found",
    });
    expect(pageWithCopy(base, HOURS, home)).toEqual({ pageId: home, copyId: "on-home" });
    expect(pageWithCopy(base, "other", home)).toBeUndefined();
  });
});

describe("unpublishedRoots (#1512)", () => {
  const copy = (id: string, props: Record<string, unknown> = {}): NodeDoc => ({
    type: "SharedSectionCopy",
    props: { id, sharedSectionId: HOURS, ...props },
  });

  /** The site above, with elements left out in each place, and a draft page and a Blog post. */
  function leftOut(): SiteDoc {
    const base = site();
    const [home, notFound] = base.pageOrder;
    const homePage = home === undefined ? undefined : base.pages[home];
    const notFoundPage = notFound === undefined ? undefined : base.pages[notFound];
    if (homePage === undefined || notFoundPage === undefined) throw new Error("No pages");
    base.layout.header.push(node("header-off", { hidden: true }));
    base.layout.footer.push(node("footer-off", { hidden: true }));
    // A section left out with an element in it left out too, and one inside a shown section.
    homePage.doc.content.push(
      node("section-off", { hidden: true, content: [node("inside-off", { hidden: true })] }),
      node("shown", { content: [node("list", { items: [node("item-off", { hidden: true })] })] }),
      copy("hours-on-home"),
    );
    notFoundPage.doc.content.push(copy("hours-off", { hidden: true }));
    const shared = base.sharedSections[HOURS];
    if (shared === undefined) throw new Error("No shared section");
    shared.section = node("shared", { content: [node("shared-off", { hidden: true })] });
    const blog = base.collections[BLOG];
    if (blog === undefined) throw new Error("No Blog");
    blog.design.after.push(node("design-off", { hidden: true }));
    const draft = { ...homePage, id: "draft" as typeof homePage.id, kind: "page" as const };
    const post = { ...homePage, id: "post" as typeof homePage.id, kind: "page" as const };
    return {
      ...base,
      pages: {
        ...base.pages,
        [draft.id]: {
          ...draft,
          settings: { ...draft.settings, draft: true },
          doc: { root: { props: {} }, content: [node("draft-off", { hidden: true })] },
        },
        [post.id]: {
          ...post,
          collection: BLOG,
          settings: { ...post.settings, hideHeader: true },
          doc: { root: { props: {} }, content: [] },
        },
      },
      pageOrder: [...base.pageOrder, draft.id, post.id],
    };
  }

  const ids = (roots: ReturnType<typeof unpublishedRoots>) =>
    roots.map(({ node: each, on }) => `${on}:${each.props.id}`);

  it("lists the outermost of each element left out of the published site, each place once", () => {
    const doc = leftOut();
    const [home, notFound] = doc.pageOrder;
    expect(ids(unpublishedRoots(doc))).toEqual([
      "header:header-off",
      "footer:footer-off",
      `${home}:hidden`,
      `${home}:section-off`,
      `${home}:item-off`,
      `${notFound}:hours-off`,
      `${HOURS}:shared-off`,
      `${BLOG}:design-off`,
    ]);
  });

  it("leaves out a draft's elements, a shared section no page shows, and a design with no post", () => {
    const doc = leftOut();
    const [home, notFound] = doc.pageOrder;
    const kept = [home, notFound].flatMap((id) => (id === undefined ? [] : [id]));
    const pages: typeof doc.pages = {};
    for (const id of kept) {
      const entry = doc.pages[id];
      if (entry !== undefined) pages[id] = entry;
    }
    const unshown = { ...doc, pages, pageOrder: kept };
    const homePage = home === undefined ? undefined : unshown.pages[home];
    if (homePage === undefined) throw new Error("No home page");
    homePage.doc.content = homePage.doc.content.filter((each) => each.props.id !== "hours-on-home");
    expect(ids(unpublishedRoots(unshown))).not.toContain(`${HOURS}:shared-off`);
    expect(ids(unpublishedRoots(unshown))).not.toContain(`${BLOG}:design-off`);
    expect(ids(unpublishedRoots(doc))).not.toContain("draft:draft-off");
  });

  it("counts the Header and the Footer only while a published page shows them", () => {
    const doc = leftOut();
    // Every published page hides the Header, and all but a draft the Footer.
    const pages: typeof doc.pages = {};
    for (const [id, entry] of Object.entries(doc.pages)) {
      if (entry === undefined) continue;
      const draft = entry.settings.draft === true;
      pages[id as keyof typeof pages] = {
        ...entry,
        settings: { ...entry.settings, hideHeader: true, hideFooter: !draft },
      };
    }
    const found = ids(unpublishedRoots({ ...doc, pages }));
    expect(found).not.toContain("header:header-off");
    expect(found).not.toContain("footer:footer-off");
    expect(found).toContain(`${BLOG}:design-off`);
  });

  it("lists what one page leaves out, in the order it's drawn, with the Header and Footer it shows", () => {
    const doc = leftOut();
    const [home, notFound] = doc.pageOrder;
    if (home === undefined || notFound === undefined) throw new Error("No pages");
    expect(ids(unpublishedRoots(doc, { page: home }))).toEqual([
      "header:header-off",
      `${home}:hidden`,
      `${home}:section-off`,
      `${home}:item-off`,
      `${HOURS}:shared-off`,
      "footer:footer-off",
    ]);
    // A copy left out counts as itself, not what's in it.
    expect(ids(unpublishedRoots(doc, { page: notFound }))).toEqual([
      "header:header-off",
      `${notFound}:hours-off`,
      "footer:footer-off",
    ]);
    // A post hides the Header here, and has its design's around its content.
    expect(ids(unpublishedRoots(doc, { page: "post" as typeof home }))).toEqual([
      `${BLOG}:design-off`,
      "footer:footer-off",
    ]);
    // A draft's own, as Preview shows a draft.
    expect(ids(unpublishedRoots(doc, { page: "draft" as typeof home }))).toContain(
      "draft:draft-off",
    );
    expect(unpublishedRoots(doc, { page: "missing" as typeof home })).toEqual([]);
  });
});
