import { createFakeEngine } from "@webforge/test-utils/renderer";
import { describe, expect, it, vi } from "vitest";
import { sessionWith } from "../testing/fixtures.js";
import { addBlog, addPost } from "./blog-actions.js";
import { connectCanvasPosts } from "./canvas-posts.js";

describe("connectCanvasPosts (6.10b)", () => {
  it("gives the canvas the site's posts, again only when what the lists show changes", () => {
    const session = sessionWith();
    const engine = createFakeEngine();
    connectCanvasPosts(engine, session);
    const posts = () => vi.mocked(engine.setPosts).mock.lastCall?.[0];
    // No Blog yet: Latest posts shows its hint.
    expect(engine.setPosts).toHaveBeenLastCalledWith(undefined);

    const first = addBlog(session);
    const blog = posts()?.();
    expect(blog?.name).toBe("Blog");
    expect(blog?.items.map((item) => item.pageId)).toEqual([first]);
    expect(posts()?.("nothing")).toBeUndefined();
    const calls = vi.mocked(engine.setPosts).mock.calls.length;

    // Editing a post's own text changes nothing a list shows.
    session.edit("props", "Edited", (draft) => {
      const post = draft.pages[first];
      if (post !== undefined) post.doc.content = [];
    });
    expect(vi.mocked(engine.setPosts).mock.calls.length).toBe(calls);

    const [collection] = Object.values(session.history.document.getState().collections);
    if (collection === undefined) throw new Error("no blog");
    addPost(session, collection.id);
    expect(posts()?.()?.items).toHaveLength(2);
  });
});
