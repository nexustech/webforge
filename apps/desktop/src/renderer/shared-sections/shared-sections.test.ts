import {
  copiedNodeId,
  isSharedCopy,
  type NodeDoc,
  SHARED_COPY_TYPE,
  type SharedSectionId,
  type SiteDoc,
} from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import { createEditorSession, currentPage, type EditorSession } from "../editor/editor-session.js";
import { starterSite } from "../editor/starter-site.js";
import {
  anchorsTakenInSection,
  copySelection,
  detachCopy,
  reachOf,
  savableSection,
  saveAsSharedSection,
  updateSectionField,
} from "./shared-sections.js";

const content = (session: EditorSession) => currentPage(session)?.doc.content ?? [];
const labels = (session: EditorSession) =>
  session.history.state.getState().entries.map((entry) => entry.label);
const site = (session: EditorSession) => session.history.document.getState();
const select = (session: EditorSession, nodeId: string | null) => session.ui.setState({ nodeId });

/** The starter site with its section anchored `hours`, saved as the shared section "Hours". */
function savedSession(): EditorSession {
  const start = starterSite();
  const home = start.pages[start.homePageId];
  const section = home?.doc.content[0];
  if (section !== undefined) section.props.advanced = { anchorId: "hours" };
  const session = createEditorSession(siteLibrary, start);
  select(session, "section-1");
  saveAsSharedSection(session, "Hours");
  return session;
}

/** The one shared section of `session`'s site. */
function theShared(session: EditorSession) {
  const [shared] = Object.values(site(session).sharedSections);
  if (shared === undefined) throw new Error("no shared section");
  return shared;
}

/** The page's copies of shared sections. */
const copiesOn = (session: EditorSession) => content(session).filter(isSharedCopy);

describe("shared sections in the editor (1.29, F-ED-23)", () => {
  it("saves the selected section as a shared section, the page showing it as its first copy", () => {
    const session = savedSession();
    const shared = theShared(session);
    const [copy] = copiesOn(session);

    expect(shared.name).toBe("Hours");
    expect(shared.section.props.id).toBe("section-1");
    // As it was, anchor included: the copy shows the same anchor, so links to it still work.
    expect(shared.section.props.advanced).toEqual({ anchorId: "hours" });
    expect(copy?.props).toEqual({ id: copy?.props.id, sharedSectionId: shared.id });
    expect(content(session)).toHaveLength(1);
    // Selected as the canvas shows it.
    expect(session.ui.getState().nodeId).toBe(copiedNodeId(copy?.props.id ?? "", "section-1"));
    expect(labels(session)).toEqual(["Saved 'Hours' as a shared section"]);

    session.history.undo();
    expect(site(session).sharedSections).toEqual({});
    expect(content(session)[0]?.props.id).toBe("section-1");
    session.history.redo();
    expect(theShared(session).id).toBe(shared.id);
  });

  it("saves only a section of the page itself: not a copy, not an element in a section", () => {
    const session = savedSession();
    const { pageId } = session.ui.getState();
    const [copy] = copiesOn(session);

    expect(savableSection(site(session), pageId, copy?.props.id ?? null)).toBeUndefined();
    expect(savableSection(site(session), pageId, session.ui.getState().nodeId)).toBeUndefined();
    expect(savableSection(site(session), pageId, "heading-1")).toBeUndefined();
    expect(savableSection(site(session), pageId, null)).toBeUndefined();

    select(session, "heading-1");
    expect(saveAsSharedSection(session, "Nope")).toBe(false);
    expect(labels(session)).toHaveLength(1);
  });

  it("finds an element the canvas shows in a copy where its shared section holds it", () => {
    const session = savedSession();
    const { pageId } = session.ui.getState();
    const [copy] = copiesOn(session);
    const id = copy?.props.id ?? "";

    const found = copySelection(site(session), pageId, copiedNodeId(id, "heading-1"));
    expect(found?.copy).toBe(copy);
    expect(found?.node.props.id).toBe("heading-1");
    expect(found?.shared.name).toBe("Hours");
    expect(copySelection(site(session), pageId, "heading-1")).toBeUndefined();
    expect(copySelection(site(session), pageId, copiedNodeId(id, "gone"))).toBeUndefined();
    expect(copySelection(site(session), pageId, null)).toBeUndefined();
  });

  it("changes a field of an element in a shared section, so every copy shows it", () => {
    const session = savedSession();
    const before = site(session);
    const { id } = theShared(session);

    session.edit("props", "Edited", (draft) => {
      expect(updateSectionField(draft, before, id, "heading-1", "text", () => "Open")).toBe(true);
      expect(updateSectionField(draft, before, id, "gone", "text", () => "x")).toBe(false);
      expect(
        updateSectionField(draft, before, "nope" as SharedSectionId, "heading-1", "text", () => 1),
      ).toBe(false);
    });

    const heading = (theShared(session).section.props.content as NodeDoc[])[0];
    expect(heading?.props.text).toBe("Open");
  });

  it("counts a shared section's copies and the pages they are on", () => {
    const session = savedSession();
    const shared = theShared(session);
    const copy = (id: string, anchorSuffix?: string): NodeDoc => ({
      type: SHARED_COPY_TYPE,
      props: { id, sharedSectionId: shared.id, ...(anchorSuffix ? { anchorSuffix } : {}) },
    });
    const doc = site(session);
    const pages = Object.values(doc.pages);
    const other = pages.find((page) => page.id !== doc.homePageId);
    if (other === undefined) throw new Error("no other page");
    const more: SiteDoc = {
      ...doc,
      pages: {
        ...doc.pages,
        [other.id]: {
          ...other,
          doc: { root: { props: {} }, content: [copy("a"), copy("b", "2")] },
        },
      },
    };

    expect(reachOf(doc, shared.id)).toEqual({ copies: 1, pages: 1 });
    expect(reachOf(more, shared.id)).toEqual({ copies: 3, pages: 2 });
  });

  it("knows the anchors an element of a shared section can't take, on every page with a copy", () => {
    const session = savedSession();
    const shared = theShared(session);
    const doc = site(session);
    const home = doc.pages[doc.homePageId];
    if (home === undefined) throw new Error("no home page");
    const anchored = (id: string, anchorId: string): NodeDoc => ({
      type: "Section",
      props: { id, advanced: { anchorId }, content: [] },
    });
    const second: NodeDoc = {
      type: SHARED_COPY_TYPE,
      props: { id: "c2", sharedSectionId: shared.id, anchorSuffix: "2" },
    };
    const withMore: SiteDoc = {
      ...doc,
      pages: {
        ...doc.pages,
        [home.id]: {
          ...home,
          doc: {
            ...home.doc,
            content: [...home.doc.content, second, anchored("x", "team"), anchored("y", "menu-2")],
          },
        },
      },
    };

    const taken = anchorsTakenInSection(withMore, shared.id, "heading-1");
    // The section's own (`hours`); the page's `team` and `menu-2`, which the first copy would
    // show as they are; and `menu`, which the second copy would show as `menu-2`.
    expect(taken.sort()).toEqual(["hours", "menu", "menu-2", "team"]);
    // Its own anchor isn't taken from it.
    expect(anchorsTakenInSection(withMore, shared.id, "section-1")).not.toContain("hours");
  });

  it("detaches a copy into a normal section with new ids and the copy's anchors", () => {
    const session = savedSession();
    const shared = theShared(session);
    const [copy] = copiesOn(session);
    select(session, copiedNodeId(copy?.props.id ?? "", "heading-1"));

    expect(detachCopy(session)).toBe(true);

    const [section] = content(session);
    expect(section?.type).toBe("Section");
    expect(isSharedCopy(section as NodeDoc)).toBe(false);
    expect(section?.props.advanced).toEqual({ anchorId: "hours" });
    expect(JSON.stringify(section)).not.toContain("~");
    expect(section?.props.id).not.toBe("section-1");
    expect(session.ui.getState().nodeId).toBe(section?.props.id);
    // The shared section stays, for its other copies and the Add panel.
    expect(theShared(session)).toBe(shared);
    expect(labels(session).at(-1)).toBe("Detached 'Hours'");

    session.history.undo();
    expect(copiesOn(session)).toEqual([copy]);
    // Only an element of a copy can be detached.
    select(session, null);
    expect(detachCopy(session)).toBe(false);
  });
});
