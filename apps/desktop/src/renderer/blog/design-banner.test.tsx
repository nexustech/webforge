// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import type { NodeDoc } from "@webforge/model";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { SharedRegionBanner } from "../editor/SharedRegionBanner.js";
import { sessionWith } from "../testing/fixtures.js";
import { addBlog, addPost } from "./blog-actions.js";

afterEach(cleanup);

describe("the banner over a Blog's design (6.10a)", () => {
  it("says a change to the design shows on every post", () => {
    const session = sessionWith();
    const postId = addBlog(session);
    const site = () => session.history.document.getState();
    const [blog] = Object.values(site().collections);
    if (blog === undefined) throw new Error("no blog");
    const [top] = blog.design.before;
    const heading = (top?.props.content as NodeDoc[] | undefined)?.[0];
    if (heading === undefined) throw new Error("no design");
    render(<SharedRegionBanner session={session} />);

    // Adding the Blog shows its first post.
    expect(session.ui.getState().pageId).toBe(postId);
    act(() => session.select(heading.props.id));
    expect(screen.getByRole("status").textContent).toBe(
      "Editing the design of 'Blog': changes show on its 1 post",
    );

    act(() => {
      addPost(session, blog.id);
      session.select(heading.props.id);
    });
    expect(screen.getByRole("status").textContent).toBe(
      "Editing the design of 'Blog': changes show on all 2 posts",
    );
  });
});
