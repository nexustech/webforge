import { type CollectionId, isExample, type PageId } from "@webforge/model";
import type { Finding } from "@webforge/site-check";
import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it, vi } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { insertBlog, insertPost } from "../site/index.js";
import { sessionWith } from "../testing/fixtures.js";
import { confirmFor, jumpTo, type SiteCheckActions } from "./actions.js";
import { describePlace } from "./describe.js";

const BLOG = "blog" as CollectionId;

/** A session on a site with a Blog of two posts, its design's first element `title`. */
function setUp() {
  const site = starterSite();
  insertBlog(site, BLOG, "older" as PageId, "2026-01-05");
  insertPost(site, BLOG, "newer" as PageId, "Spring opening", {}, "2026-03-01");
  const session = sessionWith(site);
  const title = site.collections[BLOG]?.design.before[0]?.props.id ?? "";
  const panels = { show: vi.fn() };
  const actions: SiteCheckActions = {
    session,
    panels,
    settings: { show: vi.fn() },
    commands: { run: vi.fn() },
    openGuide: vi.fn(),
  };
  return { session, title, panels, actions };
}

describe("a finding in a Blog's design (#936)", () => {
  it("is named by the Blog", () => {
    const { session, title } = setUp();
    const finding: Finding = { key: "k", place: { kind: "element", on: BLOG, nodeId: title } };

    expect(describePlace(finding, session.history.document.getState(), siteLibrary)).toBe(
      "Section in the design of 'Blog'",
    );
  });

  it("opens the newest post and selects the element, or keeps the post shown", () => {
    const { session, title, actions } = setUp();

    jumpTo({ kind: "element", on: BLOG, nodeId: title }, actions);
    expect(session.ui.getState()).toMatchObject({ pageId: "newer", nodeId: title });

    session.showPage("older" as PageId);
    jumpTo({ kind: "element", on: BLOG, nodeId: title }, actions);
    expect(session.ui.getState()).toMatchObject({ pageId: "older", nodeId: title });
  });

  it("shows the Pages panel when the Blog has no post to show it on", () => {
    const { session, title, panels, actions } = setUp();
    session.edit("remove", "Deleted posts", (draft) => {
      for (const id of ["older", "newer"] as PageId[]) {
        delete draft.pages[id];
        draft.pageOrder = draft.pageOrder.filter((each) => each !== id);
      }
    });
    const shown = session.ui.getState().pageId;

    jumpTo({ kind: "element", on: BLOG, nodeId: title }, actions);
    expect(panels.show).toHaveBeenCalledWith("site");
    expect(session.ui.getState().pageId).toBe(shown);
  });
});

describe("This Is Correct on a text marked as an example (#1228)", () => {
  it("clears its mark as one undo step of its own, and is offered for marked texts only", () => {
    const { session, actions } = setUp();
    const site = session.history.document.getState();
    const pageId = site.pageOrder[0] as PageId;
    const node = site.pages[pageId]?.doc.content[0];
    if (node === undefined) throw new Error("no section");
    const nodeId = node.props.id;
    const field = "title";
    session.edit("props", "Marked an example", (draft) => {
      const target = draft.pages[pageId]?.doc.content[0];
      if (target !== undefined) target.props.examples = { [field]: true, text: true };
    });
    const finding = (named = field): Finding => ({
      key: `${pageId}/${nodeId}/${named}`,
      place: { kind: "element", on: pageId, nodeId },
    });
    expect(confirmFor("placeholders", finding(), actions)).toBeUndefined();
    expect(confirmFor("sampleDetails", finding("label"), actions)).toBeUndefined();

    const confirm = confirmFor("sampleDetails", finding(), actions);
    confirm?.();
    const marked = () =>
      session.history.document.getState().pages[pageId]?.doc.content[0]?.props ?? {};
    // Every mark of the element, as Site Check lists it once.
    expect(marked().examples).toBeUndefined();
    expect(session.history.entries().at(-1)?.label).toMatch(/example as correct/);
    // Gone, nothing more is offered; undone, it's marked again.
    expect(confirmFor("sampleDetails", finding(), actions)).toBeUndefined();
    session.history.undo();
    expect(isExample(marked(), field)).toBe(true);
  });
});
