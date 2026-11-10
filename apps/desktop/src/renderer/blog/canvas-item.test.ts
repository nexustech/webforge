import { createFakeEngine } from "@webforge/test-utils/renderer";
import { isValidElement } from "react";
import { describe, expect, it } from "vitest";
import { sessionWith } from "../testing/fixtures.js";
import { addBlog } from "./blog-actions.js";
import { connectCanvasItem } from "./canvas-item.js";

describe("connectCanvasItem (6.10a)", () => {
  it("gives the canvas the post shown, again only when what it shows changes", () => {
    const session = sessionWith();
    const engine = createFakeEngine();
    const home = session.ui.getState().pageId;
    connectCanvasItem(engine, session);
    // Not a post: bound elements show their own text.
    expect(engine.setItem).toHaveBeenLastCalledWith({});

    const postId = addBlog(session);
    const shown = engine.setItem.mock.lastCall?.[0];
    expect(shown?.item?.("title")).toEqual({ kind: "text", text: "Our first post" });
    expect(shown?.item?.("picture")).toBeUndefined();
    expect(shown?.item?.("toString")).toBeUndefined();
    expect(isValidElement(shown?.emptyItem?.("picture"))).toBe(true);
    const calls = engine.setItem.mock.calls.length;

    // An edit that leaves the post's fields as they were draws nothing again.
    session.edit("props", "Edited", (draft) => {
      const post = draft.pages[postId];
      if (post !== undefined) post.doc.content = [];
    });
    expect(engine.setItem.mock.calls.length).toBe(calls);

    session.edit("props", "Renamed", (draft) => {
      const post = draft.pages[postId];
      if (post !== undefined) post.title = "Spring";
    });
    expect(engine.setItem.mock.lastCall?.[0].item?.("title")).toEqual({
      kind: "text",
      text: "Spring",
    });

    session.showPage(home);
    expect(engine.setItem).toHaveBeenLastCalledWith({});
  });
});
