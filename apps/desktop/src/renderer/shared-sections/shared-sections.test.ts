import {
  copiedNodeId,
  expandSharedCopies,
  isSharedCopy,
  type NodeDoc,
  SHARED_COPY_TYPE,
  type SharedSectionId,
  type SiteDoc,
} from "@webforge/model";
import { describe, expect, it } from "vitest";
import { currentPage, type EditorSession } from "../editor/editor-session.js";
import { starterSite } from "../editor/starter-site.js";
import { sessionWith } from "../testing/fixtures.js";
import {
  anchorsTakenInSection,
  copySelection,
  deleteSharedSection,
  detachCopy,
  nameProblem,
  reachOf,
  renameSharedSection,
  savableSection,
  saveAsSharedSection,
  sharedSection,
  updateSectionField,
} from "./shared-sections.js";

const content = (session: EditorSession) => currentPage(session)?.doc.content ?? [];
const labels = (session: EditorSession) =>
  session.history.state.getState().entries.map((entry) => entry.label);
const site = (session: EditorSession) => session.history.document.getState();
const select = (session: EditorSession, nodeId: string | null) => session.select(nodeId);

/** The starter site with its section anchored `hours`, saved as the shared section "Hours". */
function savedSession(): EditorSession {
  const start = starterSite();
  const home = start.pages[start.homePageId];
  const section = home?.doc.content[0];
  if (section !== undefined) section.props.advanced = { anchorId: "hours" };
  const session = sessionWith(start);
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

  it("keeps a saved section's Layers name and hidden state on its first copy only (F-ED-12)", () => {
    const start = starterSite();
    const section = start.pages[start.homePageId]?.doc.content[0];
    if (section !== undefined) Object.assign(section.props, { layerName: "Welcome", hidden: true });
    const session = sessionWith(start);
    select(session, "section-1");

    saveAsSharedSection(session, "Hours");

    const shared = theShared(session);
    expect(shared.section.props.layerName).toBeUndefined();
    expect(shared.section.props.hidden).toBeUndefined();
    const [copy] = copiesOn(session);
    expect(copy?.props).toMatchObject({ layerName: "Welcome", hidden: true });
    // The page shows it as before, hidden and named; a copy placed later is neither.
    const [shown, later] = expandSharedCopies(
      [
        ...content(session),
        {
          type: SHARED_COPY_TYPE,
          props: { id: "c2", sharedSectionId: shared.id, anchorSuffix: "2" },
        },
      ],
      site(session).sharedSections,
    );
    expect(shown?.props).toMatchObject({ layerName: "Welcome", hidden: true });
    expect(later?.props.hidden).toBeUndefined();
    expect(later?.props.layerName).toBeUndefined();
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
    // The section's own (`hours`); the page's `team` and `menu-2`, and the second copy's
    // `hours-2`, which the first copy would show as they are; and `menu`, which the second copy
    // would show as `menu-2`.
    expect(taken.sort()).toEqual(["hours", "hours-2", "menu", "menu-2", "team"]);
    // Its own anchor isn't taken from it.
    expect(anchorsTakenInSection(withMore, shared.id, "section-1")).not.toContain("hours");

    // Another element of the section anchored `title-2`: the first copy shows it as `title-2`,
    // which the second copy would show for `title`.
    const titled = structuredClone(withMore);
    const text = (
      titled.sharedSections[shared.id]?.section.props.content as NodeDoc[] | undefined
    )?.[1];
    if (text !== undefined) text.props.advanced = { anchorId: "title-2" };
    expect(anchorsTakenInSection(titled, shared.id, "heading-1")).toContain("title");
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

  it("finds a shared section the site has as its own, never an object's built-in key", () => {
    const session = savedSession();
    const { id } = theShared(session);

    expect(sharedSection(site(session), id)?.name).toBe("Hours");
    // A plain lookup would give Object's own function here (Stream A's #199 review).
    for (const key of ["constructor", "toString", "__proto__"]) {
      expect(sharedSection(site(session), key as SharedSectionId)).toBeUndefined();
    }
  });

  it("refuses a name another shared section has, whatever its capitals or spaces", () => {
    const session = savedSession();
    const shared = theShared(session);
    const before = site(session);

    for (const name of ["Hours", "hours", "  HOURS ", "hOuRs"]) {
      expect(nameProblem(before, name)).toBe("A shared section called 'Hours' already exists");
    }
    expect(nameProblem(before, "Hours later")).toBeUndefined();
    // Its own name, when renaming it.
    expect(nameProblem(before, " hours", shared.id)).toBeUndefined();

    // Saving another section under a name in use changes nothing.
    const other = sessionWith(before);
    const notFound = Object.values(before.pages).find((page) => page.kind === "not-found");
    if (notFound === undefined) throw new Error("no 'Page not found' page");
    other.showPage(notFound.id);
    other.select(notFound.doc.content[0]?.props.id ?? null);
    expect(saveAsSharedSection(other, "HOURS")).toBe(false);
    expect(other.history.entries()).toEqual([]);
    expect(saveAsSharedSection(other, "Team")).toBe(true);
  });

  it("renames a shared section in one step, refusing a name in use", () => {
    const session = savedSession();
    const { id } = theShared(session);

    expect(renameSharedSection(session, id, "  Opening hours ")).toBe(true);
    expect(theShared(session).name).toBe("Opening hours");
    expect(labels(session).at(-1)).toBe("Renamed 'Hours' to 'Opening hours'");
    // Its own name again, with other capitals: allowed.
    expect(renameSharedSection(session, id, "OPENING HOURS")).toBe(true);
    expect(theShared(session).name).toBe("OPENING HOURS");

    session.edit("props", "Added a shared section", (draft) => {
      const other = "shared-other" as SharedSectionId;
      draft.sharedSections[other] = { ...theShared(session), id: other, name: "Team" };
    });
    const steps = labels(session).length;
    expect(renameSharedSection(session, id, " team")).toBe(false);
    expect(renameSharedSection(session, id, "   ")).toBe(false);
    expect(renameSharedSection(session, "gone" as SharedSectionId, "New")).toBe(false);
    expect(labels(session)).toHaveLength(steps);

    session.history.undo();
    session.history.undo();
    expect(theShared(session).name).toBe("Opening hours");
  });

  it("deletes a shared section, its copies on every page becoming normal sections, in one step", () => {
    const session = savedSession();
    const shared = theShared(session);
    const [first] = copiesOn(session);
    const doc = site(session);
    const notFound = Object.values(doc.pages).find((page) => page.kind === "not-found");
    if (first === undefined || notFound === undefined) throw new Error("no copy");
    // A second copy on the other page, hidden and named in Layers.
    session.edit("insert", "Added a copy", (draft) => {
      draft.pages[notFound.id]?.doc.content.push({
        type: SHARED_COPY_TYPE,
        props: { id: "c2", sharedSectionId: shared.id, layerName: "Hours again", hidden: true },
      });
    });
    select(session, copiedNodeId(first.props.id, "heading-1"));

    expect(deleteSharedSection(session, shared.id)).toBe(true);

    expect(site(session).sharedSections).toEqual({});
    const [section] = content(session);
    expect(section?.type).toBe("Section");
    expect(section?.props.advanced).toEqual({ anchorId: "hours" });
    expect(JSON.stringify(section)).toContain("Welcome to our business");
    expect(JSON.stringify(section)).not.toContain("~");
    const other = site(session).pages[notFound.id]?.doc.content.at(-1);
    expect(other?.type).toBe("Section");
    expect(other?.props).toMatchObject({ layerName: "Hours again", hidden: true });
    expect(other?.props.id).not.toBe(section?.props.id);
    // The selection inside the copy moves to the section it became.
    expect(session.ui.getState().nodeId).toBe(section?.props.id);
    expect(labels(session).at(-1)).toBe("Deleted shared section 'Hours'");

    session.history.undo();
    expect(theShared(session)).toEqual(shared);
    expect(copiesOn(session)).toEqual([first]);
    expect(deleteSharedSection(session, "gone" as SharedSectionId)).toBe(false);
  });
});
