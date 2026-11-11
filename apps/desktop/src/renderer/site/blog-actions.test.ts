import {
  type CollectionId,
  changedDocuments,
  migrateSite,
  type NodeDoc,
  type PageId,
  type SiteDoc,
  siteDocSchema,
  validateSiteChanges,
} from "@webforge/model";
import { siteLibrary, siteSnapshotFor } from "@webforge/site-components";
import { createFakeEngine } from "@webforge/test-utils/renderer";
import { describe, expect, it, vi } from "vitest";
import { connectEngine } from "../editor/editor-session.js";
import { confirmSharedRemovals } from "../editor/shared-confirmations.js";
import { canvasLayout } from "../editor/shared-layout.js";
import type { SiteWideAction } from "../shell/confirm-site-wide.js";
import { sessionWith } from "../testing/fixtures.js";
import {
  addBlog,
  addPost,
  blogDesign,
  blogFolderFor,
  canDeleteBlog,
  deleteBlog,
  insertBlog,
  renameBlog,
  renameMovesBlog,
} from "./blog-actions.js";
import {
  addPage,
  canBeHome,
  canChangeNavigation,
  canMoveToFolder,
  changePageSettings,
  deletePage,
  duplicatePage,
  moveToFolder,
  type PageSettingsChange,
} from "./page-actions.js";

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
    expect(blog?.fields.map((field) => field.label)).toEqual([
      "Date",
      "Summary",
      "Picture",
      "Tags",
    ]);
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

  it("binds the design's title, date and picture to each post's, with its tags and a button back Home", () => {
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
      { type: "PostTags", props: { id: "n6" } },
      {
        type: "Button",
        props: { id: "n7", label: "Back to Home", link: { kind: "page", pageId: "home" } },
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

describe("renameBlog (#937)", () => {
  it("renames the Blog alone, one step, its posts staying where they are", () => {
    const { session, site, labels, blogId } = setUp();
    const postId = addBlog(session);

    renameBlog(session, blogId(), "  News  ", false, true);

    expect(site().collections[blogId()]).toMatchObject({ name: "News", folder: "blog" });
    expect(site().pages[postId]?.folder).toBe("blog");
    expect(site().settings.search.keptAddresses).toBeUndefined();
    expect(labels().at(-1)).toBe("Renamed blog 'News'");
    // The same name, or none, changes nothing.
    renameBlog(session, blogId(), "News", false, true);
    renameBlog(session, blogId(), "   ", true, true);
    expect(labels()).toHaveLength(2);
  });

  it("moves the posts to the new name's folder, keeping their old addresses, through save, undo and export", () => {
    const { session, site, labels, blogId } = setUp();
    const first = addBlog(session);
    const second = addPost(session, blogId(), "Spring opening") ?? ("" as PageId);
    const before = site();

    expect(renameMovesBlog(before, blogId(), "News")).toBe(true);
    expect(renameMovesBlog(before, blogId(), "Blog")).toBe(false);
    renameBlog(session, blogId(), "News", true, true);

    expect(labels().at(-1)).toBe("Renamed blog 'News'");
    expect(site().collections[blogId()]).toMatchObject({ name: "News", folder: "news" });
    expect([site().pages[first]?.folder, site().pages[second]?.folder]).toEqual(["news", "news"]);
    expect(site().settings.search.keptAddresses).toEqual([
      { from: "blog/our-first-post.html", page: first },
      { from: "blog/spring-opening.html", page: second },
    ]);

    const saved = savedAndOpened(before, site());
    expect(saved).toEqual(site());
    const snapshot = siteSnapshotFor(saved, siteLibrary);
    expect(snapshot.pages.find((each) => each.id === first)?.path).toBe("news/our-first-post");

    session.history.undo();
    expect(site()).toEqual(before);
    expect(savedAndOpened(saved, site())).toEqual(before);
  });

  it("keeps no old addresses for a site never published, and gives the posts a free folder", () => {
    const { session, site, blogId } = setUp();
    const postId = addBlog(session);
    // An ordinary page is in a folder called "news" already.
    const page = addPage(session, "Local") ?? ("" as PageId);
    moveToFolder(session, page, "news", false);

    expect(blogFolderFor(site(), blogId(), "News!")).toBe("news-2");
    renameBlog(session, blogId(), "News!", true, false);

    expect(site().pages[postId]?.folder).toBe("news-2");
    expect(site().settings.search.keptAddresses).toBeUndefined();
    expect(siteDocSchema.safeParse(site()).success).toBe(true);
  });

  it("tidies an old address a post has again when renamed back", () => {
    const { session, site, blogId } = setUp();
    addBlog(session);
    renameBlog(session, blogId(), "News", true, true);
    renameBlog(session, blogId(), "Blog", true, true);

    expect(site().collections[blogId()]?.folder).toBe("blog");
    expect(site().settings.search.keptAddresses?.map((kept) => kept.from)).toEqual([
      "news/our-first-post.html",
    ]);
  });
});

describe("deleteBlog (#937)", () => {
  it("deletes a Blog with no posts as one step, and never one with posts", () => {
    const { session, site, labels, blogId } = setUp();
    const postId = addBlog(session);
    const id = blogId();

    expect(canDeleteBlog(site(), id)).toBe(false);
    deleteBlog(session, id);
    expect(site().collections[id]).toBeDefined();

    deletePage(session, postId);
    expect(canDeleteBlog(site(), id)).toBe(true);
    const before = site();
    deleteBlog(session, id);

    expect(site().collections).toEqual({});
    expect(labels().at(-1)).toBe("Deleted blog 'Blog'");
    expect(savedAndOpened(before, site()).collections).toEqual({});
    session.history.undo();
    expect(site().collections[id]?.name).toBe("Blog");
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

describe("removing from a post's design or Header (6.10a, D7)", () => {
  /** A session on a post, with the Footer's own Heading, connected through the confirmations. */
  function onPost(answer: boolean) {
    const site = sessionWith().history.document.getState();
    const withFooter = structuredClone(site);
    withFooter.layout.footer.push({ type: "Heading", props: { id: "fh", text: "Hours" } });
    const session = sessionWith(withFooter);
    const postId = addBlog(session);
    const engine = createFakeEngine();
    const confirmSiteWide = vi.fn((_action: SiteWideAction) => Promise.resolve(answer));
    connectEngine(
      confirmSharedRemovals(engine, session, { confirmSiteWide, busy: () => false }),
      session,
    );
    const now = () => session.history.document.getState();
    const design = () => Object.values(now().collections)[0]?.design;
    const remove = (nodeId: string, componentType: string) => {
      const drawn = structuredClone(canvasLayout(now(), postId));
      engine.edit({
        kind: "remove",
        nodeId,
        componentType,
        page: now().pages[postId]?.doc ?? { root: { props: {} }, content: [] },
        selection: null,
        shared: true,
        layout: drawn,
      });
    };
    return { session, engine, confirmSiteWide, now, design, remove, postId };
  }
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("asks before an element leaves the design, saying every post shows it", async () => {
    const { confirmSiteWide, design, remove } = onPost(true);
    const button = ((design()?.after[0]?.props.content ?? []) as NodeDoc[]).at(-1);
    if (button === undefined) throw new Error("no button");

    remove(button.props.id, "Button");
    await flush();

    expect(confirmSiteWide).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "Delete Button from the design of 'Blog'?",
        description: "Every post shows the change.",
        affectedPages: 1,
      }),
    );
    expect(
      ((design()?.after[0]?.props.content ?? []) as NodeDoc[]).map((node) => node.type),
    ).toEqual(["PostTags"]);
  });

  it("keeps the design when an element leaves the Footer on a post, or a removal is cancelled", async () => {
    const confirmed = onPost(true);
    const before = confirmed.design();

    confirmed.remove("fh", "Heading");
    await flush();

    expect(confirmed.now().layout.footer.some((node) => node.props.id === "fh")).toBe(false);
    expect(confirmed.design()).toEqual(before);

    const cancelled = onPost(false);
    cancelled.remove("fh", "Heading");
    await flush();
    expect(cancelled.engine.applyChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ layout: canvasLayout(cancelled.now(), cancelled.postId) }),
    );
  });
});
