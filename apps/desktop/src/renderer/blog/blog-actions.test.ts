import {
  type CollectionId,
  changedDocuments,
  migrateSite,
  type PageId,
  type SiteDoc,
  siteDocSchema,
  validateSiteChanges,
} from "@webforge/model";
import { siteLibrary, siteSnapshotFor } from "@webforge/site-components";
import { createFakeEngine } from "@webforge/test-utils/renderer";
import { describe, expect, it } from "vitest";
import { connectEngine } from "../editor/editor-session.js";
import { canvasLayout } from "../editor/shared-layout.js";
import {
  canBeHome,
  canChangeNavigation,
  canMoveToFolder,
  changePageSettings,
  duplicatePage,
  type PageSettingsChange,
} from "../site/page-actions.js";
import { sessionWith } from "../testing/fixtures.js";
import { addBlog, addPost, blogDesign, insertBlog } from "./blog-actions.js";

function setUp() {
  const session = sessionWith();
  const site = () => session.history.document.getState();
  const labels = () => session.history.entries().map((entry) => entry.label);
  const shown = () => session.ui.getState().pageId;
  const blogId = () => {
    const [blog] = Object.values(site().collections);
    if (blog === undefined) throw new Error("no blog");
    return blog.id;
  };
  return { session, site, labels, shown, blogId };
}

/** A site's documents as stored, put back together and opened, as saving and reopening do. */
function savedAndOpened(before: SiteDoc | undefined, after: SiteDoc): SiteDoc {
  const checked = validateSiteChanges(before, changedDocuments(before, after));
  if (!checked.success) throw new Error("the changes were refused");
  return migrateSite(JSON.parse(JSON.stringify(checked.data)));
}

describe("addBlog (6.10a)", () => {
  it("adds the Blog and a first post, shows the post, as one undo step", () => {
    const { session, site, labels, shown, blogId } = setUp();
    const before = site();

    const postId = addBlog(session);

    const blog = site().collections[blogId()];
    const post = site().pages[postId];
    expect(blog).toMatchObject({ preset: "blog", name: "Blog", folder: "blog" });
    expect(blog?.fields.map((field) => field.label)).toEqual(["Date", "Summary", "Picture"]);
    expect(post).toMatchObject({
      title: "Our first post",
      slug: "our-first-post",
      folder: "blog",
      collection: blogId(),
      entry: { summary: "What's new, in a sentence or two." },
    });
    expect(post?.entry?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(shown()).toBe(postId);
    expect(labels()).toEqual(["Added a blog"]);
    expect(siteDocSchema.safeParse(site()).success).toBe(true);
    // Not in the menu: the Blog lists its posts.
    expect(site().menu).toEqual(before.menu);

    session.history.undo();
    expect(site().collections).toEqual({});
    expect(site().pages[postId]).toBeUndefined();
  });

  it("binds the design's title, date and picture to each post's, with a button back Home", () => {
    let n = 0;
    const design = blogDesign("home" as PageId, () => `n${++n}`);
    const [top] = design.before;
    const elements = top?.props.content as { type: string; props: Record<string, unknown> }[];

    expect(elements.map((each) => [each.type, each.props.bindings])).toEqual([
      ["Heading", { text: "item.title" }],
      ["Text", { text: "item.date" }],
      ["Image", { image: "item.picture" }],
    ]);
    expect(design.after[0]?.props.content).toEqual([
      {
        type: "Button",
        props: { id: "n6", label: "Back to Home", link: { kind: "page", pageId: "home" } },
      },
    ]);
  });

  it("gives a second Blog a folder of its own", () => {
    const { site } = setUp();
    const draft = structuredClone(site());
    insertBlog(draft, "a" as CollectionId, "p1" as PageId, "2026-11-10");
    insertBlog(draft, "b" as CollectionId, "p2" as PageId, "2026-11-10");

    expect(draft.collections["b" as CollectionId]?.folder).toBe("blog-2");
    expect(siteDocSchema.safeParse(draft).success).toBe(true);
  });
});

describe("addPost (6.10a)", () => {
  it("adds a post in the Blog's folder, named for undo, and shows it", () => {
    const { session, site, labels, shown, blogId } = setUp();
    addBlog(session);

    const first = addPost(session, blogId());
    const second = addPost(session, blogId());

    expect(site().pages[first ?? ("" as PageId)]).toMatchObject({
      title: "New post",
      slug: "new-post",
      folder: "blog",
    });
    expect(site().pages[second ?? ("" as PageId)]?.slug).toBe("new-post-2");
    expect(shown()).toBe(second);
    expect(labels()).toEqual(["Added a blog", "Added post 'New post'", "Added post 'New post'"]);
    expect(addPost(session, "none" as CollectionId)).toBeNull();
    expect(addPost(session, blogId(), "  ")).toBeNull();
  });
});

describe("a post through save, undo and export (6.10a, acceptance)", () => {
  it("keeps the Blog and its posts when saved and reopened, and exports each in its folder", () => {
    const { session, site } = setUp();
    const empty = site();
    const postId = addBlog(session);
    const saved = savedAndOpened(empty, site());

    expect(saved).toEqual(site());

    const snapshot = siteSnapshotFor(saved, siteLibrary);
    const page = snapshot.pages.find((each) => each.id === postId);
    expect(page?.path).toBe("blog/our-first-post");
    expect(page?.item?.values.title).toEqual({ kind: "text", text: "Our first post" });
    // The design above and below the post's own section.
    expect(page?.doc.content).toHaveLength(3);

    // Undone, the saved site loses the Blog and its post again.
    session.history.undo();
    expect(savedAndOpened(saved, site())).toEqual(empty);
  });
});

describe("Page Settings for a post (6.10a)", () => {
  const change = (title: string, entry?: Record<string, string>): PageSettingsChange => ({
    title,
    slug: "",
    description: "",
    shareImage: undefined,
    hideHeader: false,
    hideFooter: false,
    hideFromNavigation: false,
    hideBackToTop: false,
    ...(entry === undefined ? {} : { entry }),
  });

  it("saves the post's fields, trimmed, the Blog's only, as one step", () => {
    const { session, site, labels } = setUp();
    const postId = addBlog(session);

    changePageSettings(
      session,
      postId,
      change("Our first post", {
        date: "2026-11-10",
        summary: "  Open  ",
        picture: "",
        colour: "x",
      }),
    );

    expect(site().pages[postId]?.entry).toEqual({ date: "2026-11-10", summary: "Open" });
    expect(labels().at(-1)).toBe("Changed post settings");
    // The same again changes nothing.
    changePageSettings(
      session,
      postId,
      change("Our first post", { date: "2026-11-10", summary: "Open" }),
    );
    expect(labels()).toHaveLength(2);
    // Without fields, a change keeps the post's.
    changePageSettings(session, postId, change("Spring"));
    expect(site().pages[postId]).toMatchObject({ title: "Spring", entry: { summary: "Open" } });
  });

  it("keeps a post in the Blog's folder, out of Home and the menu, and a copy a post", () => {
    const { session, site } = setUp();
    const postId = addBlog(session);
    const post = site().pages[postId];
    if (post === undefined) throw new Error("no post");

    expect(canMoveToFolder(site(), post)).toBe(false);
    expect(canBeHome(site(), post)).toBe(false);
    expect(canChangeNavigation(post)).toBe(false);
    const copy = duplicatePage(session, postId);
    expect(site().pages[copy ?? ("" as PageId)]).toMatchObject({
      folder: "blog",
      collection: post.collection,
      entry: post.entry,
    });
    expect(siteDocSchema.safeParse(site()).success).toBe(true);
  });
});

describe("editing a post's design on the canvas (6.10a)", () => {
  it("writes a design element's change to the Blog, named by it, for every post", () => {
    const { session, site, labels } = setUp();
    const postId = addBlog(session);
    const other = addPost(session, Object.keys(site().collections)[0] as CollectionId);
    const engine = createFakeEngine();
    connectEngine(engine, session);
    session.showPage(postId);
    const layout = canvasLayout(site(), postId);
    const top = layout.header.at(-1);
    const heading = (top?.props.content as { props: { id: string } }[] | undefined)?.[0];
    if (top === undefined || heading === undefined) throw new Error("no design");
    const edited = structuredClone(layout);
    const content = edited.header.at(-1)?.props.content as { props: Record<string, unknown> }[];
    if (content[0] !== undefined) content[0].props.size = "medium";

    engine.edit({
      kind: "props",
      nodeId: heading.props.id,
      componentType: "Heading",
      field: "size",
      page: site().pages[postId]?.doc ?? { root: { props: {} }, content: [] },
      selection: heading.props.id,
      shared: true,
      layout: edited,
    });

    const blog = Object.values(site().collections)[0];
    const [section] = blog?.design.before ?? [];
    const elements = (section?.props.content ?? []) as { props: Record<string, unknown> }[];
    expect(elements[0]?.props.size).toBe("medium");
    expect(labels().at(-1)).toBe("Edited the design of 'Blog'");
    // The other post draws the same design.
    expect(canvasLayout(site(), other ?? postId).header.at(-1)).toBe(section);
  });
});
