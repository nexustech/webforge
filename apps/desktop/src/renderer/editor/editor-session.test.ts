import {
  copiedNodeId,
  type NodeDoc,
  type PageDoc,
  type PageId,
  type SharedSectionId,
  type SiteDoc,
} from "@webforge/model";
import { siteLibrary, starterPage } from "@webforge/site-components";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  connectEngine,
  createEditorSession,
  currentPage,
  type EditKind,
  runHistoryCommand,
  TEXT_SESSION_GRACE_MS,
  TYPING_PAUSE_MS,
} from "./editor-session.js";
import { createFakeEngine } from "./fake-engine.test-helper.js";
import { starterSite } from "./starter-site.js";

const withHeadingText = (page: PageDoc, text: string): PageDoc => {
  const section = page.content[0];
  const [heading, ...rest] = (section?.props.content ?? []) as PageDoc["content"];
  if (section === undefined || heading === undefined) throw new Error("unexpected starter page");
  return {
    ...page,
    content: [
      {
        ...section,
        props: {
          ...section.props,
          content: [{ ...heading, props: { ...heading.props, text } }, ...rest],
        },
      },
    ],
  };
};

/** The starter site plus a second page, "about", with one heading. */
function siteWithAbout(): { site: SiteDoc; about: PageId } {
  const site = starterSite();
  const about = "page-about" as PageId;
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  const doc: PageDoc = {
    root: { props: {} },
    content: [{ type: "Heading", props: { id: "about-heading", text: "About us" } }],
  };
  return {
    site: {
      ...site,
      pages: { ...site.pages, [about]: { ...home, id: about, slug: "about", title: "About", doc } },
      pageOrder: [...site.pageOrder, about],
    },
    about,
  };
}

function setup() {
  const { site, about } = siteWithAbout();
  const session = createEditorSession(siteLibrary, site);
  const home = site.homePageId;
  const engine = createFakeEngine();
  const connection = connectEngine(engine, session);
  const doc = () => currentPage(session)?.doc as PageDoc;
  const labels = () => session.history.entries().map((entry) => entry.label);
  const typeHeading = (
    text: string,
    selection: string | null = "heading-1",
    typingPauseMs?: number,
  ) =>
    engine.edit({
      kind: "text",
      nodeId: "heading-1",
      componentType: "Heading",
      field: "text",
      page: withHeadingText(doc(), text),
      selection,
      ...(typingPauseMs === undefined ? {} : { typingPauseMs }),
    });
  return { session, engine, connection, doc, labels, typeHeading, home, about };
}

describe("connectEngine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("records an edit of the shared Footer in the site's layout, for every page (F-ED-7)", () => {
    const { session, engine, doc, labels, about } = setup();
    const layout = session.history.document.getState().layout;
    const [footer] = layout.footer;
    if (footer === undefined) throw new Error("no footer");
    const page = doc();

    engine.edit({
      kind: "text",
      nodeId: footer.props.id,
      componentType: "Footer",
      field: "text",
      page,
      selection: footer.props.id,
      shared: true,
      layout: { ...layout, footer: [{ ...footer, props: { ...footer.props, text: "Bye" } }] },
    });

    const site = session.history.document.getState();
    expect(site.layout.footer[0]?.props.text).toBe("Bye");
    expect(doc()).toBe(page);
    expect(labels()).toEqual(["Edited shared Footer text"]);
    // Shown with the layout, so the canvas has it whatever page it shows.
    session.showPage(about);
    session.history.undo();
    expect(engine.applyChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ layout: expect.objectContaining({ footer: [footer] }) }),
    );
    expect(session.history.document.getState().layout.footer[0]).toEqual(footer);
  });

  it("shows a page without the Header it hides, and keeps that Header for the other pages", () => {
    const { session, engine, about } = setup();
    const layout = session.history.document.getState().layout;
    const [footer] = layout.footer;
    if (footer === undefined) throw new Error("no footer");
    session.edit("props", "Changed page settings", (draft) => {
      const page = draft.pages[about];
      if (page !== undefined) page.settings.hideHeader = true;
    });

    session.showPage(about);

    expect(engine.loadPage).toHaveBeenLastCalledWith(
      expect.anything(),
      { header: [], footer: layout.footer },
      expect.anything(),
    );
    // An edit of the Footer there reports the Header the canvas showed: none. It stays as it was.
    engine.edit({
      kind: "text",
      nodeId: footer.props.id,
      componentType: "Footer",
      field: "text",
      page: currentPage(session)?.doc as PageDoc,
      selection: footer.props.id,
      shared: true,
      layout: { header: [], footer: [{ ...footer, props: { ...footer.props, text: "Bye" } }] },
    });
    const site = session.history.document.getState();
    expect(site.layout.header).toEqual(layout.header);
    expect(site.layout.footer[0]?.props.text).toBe("Bye");
  });

  it("records an edit in a linked copy in its shared section, for every copy (F-ED-23)", () => {
    const { session, engine, doc, labels } = setup();
    const HOURS = "shared-hours" as SharedSectionId;
    const section: NodeDoc = { type: "Heading", props: { id: "hours", text: "Hours" } };
    session.edit("props", "Saved", (draft) => {
      draft.sharedSections[HOURS] = { id: HOURS, name: "Opening hours", section };
    });
    const page = doc();

    engine.edit({
      kind: "text",
      nodeId: copiedNodeId("c1", "hours"),
      componentType: "Heading",
      field: "text",
      page,
      selection: copiedNodeId("c1", "hours"),
      sharedSection: { id: HOURS, section: { ...section, props: { id: "hours", text: "Open" } } },
    });

    const site = session.history.document.getState();
    expect(site.sharedSections[HOURS]?.section.props.text).toBe("Open");
    expect(doc()).toBe(page);
    expect(labels().at(-1)).toBe("Edited shared section 'Opening hours'");
    // The canvas gets the shared sections with every change, an undo included.
    session.history.undo();
    expect(engine.applyChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ shared: session.history.document.getState().sharedSections }),
    );
    expect(session.history.document.getState().sharedSections[HOURS]?.section).toEqual(section);
  });

  it("labels another copy placed by duplicating one by its shared section (F-ED-23)", () => {
    const { session, engine, doc, labels } = setup();
    const HOURS = "shared-hours" as SharedSectionId;
    session.edit("props", "Saved", (draft) => {
      draft.sharedSections[HOURS] = {
        id: HOURS,
        name: "Opening hours",
        section: { type: "Heading", props: { id: "hours", text: "Hours" } },
      };
    });
    const copy = { type: "SharedSectionCopy", props: { id: "c2", sharedSectionId: HOURS } };

    engine.edit({
      kind: "duplicate",
      nodeId: copiedNodeId("c2", "hours"),
      componentType: "Heading",
      page: { ...doc(), content: [...doc().content, copy] },
      selection: copiedNodeId("c2", "hours"),
      copyOf: HOURS,
    });

    expect(labels().at(-1)).toBe("Added a copy of 'Opening hours'");
    expect(doc().content.at(-1)).toEqual(copy);
  });

  it("records canvas edits as labelled steps in the document store", () => {
    const { engine, doc, labels } = setup();
    const page = { ...starterPage(), content: [] };

    engine.edit({ kind: "remove", nodeId: "section-1", componentType: "Section", page });

    expect(labels()).toEqual(["Deleted Section"]);
    expect(doc()).toEqual(page);
  });

  it("records a one-field edit as just that field, without comparing the page", () => {
    const { session, engine, doc } = setup();
    const before = doc();

    engine.edit({
      kind: "text",
      nodeId: "heading-1",
      componentType: "Heading",
      field: "text",
      // A page that differs elsewhere too: only the patch counts.
      page: { ...withHeadingText(before, "Hello"), content: [] },
      patch: { nodeId: "heading-1", field: "text", value: "Hello" },
    });

    expect(doc()).toEqual(withHeadingText(before, "Hello"));
    expect(session.history.entries()[0]?.forward).toEqual([
      expect.objectContaining({ op: "replace", value: "Hello" }),
    ]);
  });

  it("falls back to the whole page when the patched element isn't in the document", () => {
    const { engine, doc } = setup();
    const page = withHeadingText(doc(), "Hello");

    engine.edit({
      kind: "text",
      nodeId: "gone",
      componentType: "Heading",
      field: "text",
      page,
      patch: { nodeId: "gone", field: "text", value: "Hello" },
    });

    expect(doc()).toEqual(page);
  });

  it("sends undo, redo and jumps back to the canvas", () => {
    const { session, engine } = setup();
    engine.edit({
      kind: "remove",
      componentType: "Section",
      page: { ...starterPage(), content: [] },
    });

    session.history.undo();

    expect(engine.applied.at(-1)).toEqual(starterPage());
  });

  it("keeps a text session as one step once something else is selected (D1)", () => {
    const { session, engine, labels, typeHeading, doc } = setup();
    typeHeading("Welcome!");
    vi.advanceTimersByTime(2_000);
    typeHeading("Welcome!!");
    expect(labels()).toEqual(["Edited Heading text", "Edited Heading text"]);

    engine.selectFromCanvas("text-1");
    vi.advanceTimersByTime(TEXT_SESSION_GRACE_MS);

    expect(labels()).toEqual(["Edited Heading text"]);
    expect(session.ui.getState().nodeId).toBe("text-1");
    session.history.undo();
    expect(doc()).toEqual(starterPage());
  });

  it("keeps keystrokes saved just after the click away in the session", () => {
    const { session, engine, labels, typeHeading, doc } = setup();
    typeHeading("Welcome!");
    engine.selectFromCanvas("text-1");
    // Puck's debounced rich-text save lands after the selection moved on.
    typeHeading("Welcome!!", "text-1");
    vi.advanceTimersByTime(TEXT_SESSION_GRACE_MS);

    expect(labels()).toEqual(["Edited Heading text"]);
    expect(session.history.entries()[0]?.selectionAfter.nodeId).toBe("heading-1");
    session.history.undo();
    expect(doc()).toEqual(starterPage());
  });

  it("ends a session in its grace period before undo, so undo reverts all of it", () => {
    const { engine, labels, typeHeading, doc } = setup();
    typeHeading("Welcome!");
    vi.advanceTimersByTime(2_000);
    typeHeading("Welcome!!");
    engine.selectFromCanvas("text-1");

    engine.command("undo");

    expect(labels()).toEqual(["Edited Heading text"]);
    expect(doc()).toEqual(starterPage());
  });

  it("flush ends only a session whose grace period is running", () => {
    const { connection, labels, typeHeading, engine } = setup();
    typeHeading("A");
    vi.advanceTimersByTime(2_000);
    typeHeading("AB");

    connection.flush();
    expect(labels()).toHaveLength(2);

    engine.selectFromCanvas(null);
    connection.flush();
    expect(labels()).toHaveLength(1);
  });

  it("chunks typing by the user's own pauses, not by when the text arrives (#307)", () => {
    const { labels, typeHeading, engine, doc } = setup();
    typeHeading("Wel", "heading-1", Number.POSITIVE_INFINITY);
    // The rest, typed without a pause, arrives late from a busy canvas: still the same chunk.
    vi.advanceTimersByTime(2_000);
    typeHeading("Welcome", "heading-1", 60);
    expect(labels()).toEqual(["Edited Heading text"]);

    // A real pause in the typing starts a chunk, however soon its text arrives.
    typeHeading("Welcome!", "heading-1", TYPING_PAUSE_MS + 1);
    expect(labels()).toEqual(["Edited Heading text", "Edited Heading text"]);
    engine.command("undo");
    expect(doc()).toEqual(withHeadingText(starterPage(), "Welcome"));
    engine.command("undo");
    expect(doc()).toEqual(starterPage());
  });

  it("ends a text session when a different edit follows", () => {
    const { engine, labels, typeHeading, doc } = setup();
    typeHeading("A");
    engine.edit({ kind: "move", componentType: "Heading", page: doc() });
    typeHeading("AB");

    expect(labels()).toEqual(["Edited Heading text", "Edited Heading text"]);
  });

  it("restores the selection on undo and forwards it to the canvas (U3)", () => {
    const { session, engine, typeHeading } = setup();
    engine.selectFromCanvas("heading-1");
    typeHeading("Changed");
    engine.selectFromCanvas(null);

    session.history.undo();

    expect(session.ui.getState().nodeId).toBe("heading-1");
    expect(engine.select).toHaveBeenLastCalledWith("heading-1");
  });

  it("runs undo and redo pressed inside the canvas", () => {
    const { session, engine, typeHeading } = setup();
    typeHeading("Changed");

    engine.command("undo");
    expect(session.history.state.getState().cursor).toBe(0);
    engine.command("redo");
    expect(session.history.state.getState().cursor).toBe(1);
  });

  it("stops listening and ends the open session when disconnected", () => {
    const { session, engine, connection, typeHeading, labels } = setup();
    typeHeading("A");
    const appliedBefore = engine.applied.length;

    connection.disconnect();
    engine.edit({
      kind: "remove",
      componentType: "Section",
      page: { ...starterPage(), content: [] },
    });
    session.history.undo();

    expect(labels()).toEqual(["Edited Heading text"]);
    expect(engine.applied).toHaveLength(appliedBefore);
  });
});

describe("pages, selection and device view (U3)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const editAbout = (engine: ReturnType<typeof setup>["engine"], text: string) =>
    engine.edit({
      kind: "text",
      nodeId: "about-heading",
      componentType: "Heading",
      field: "text",
      page: {
        root: { props: {} },
        content: [{ type: "Heading", props: { id: "about-heading", text } }],
      },
      selection: "about-heading",
      patch: { nodeId: "about-heading", field: "text", value: text },
    });

  it("records canvas edits on the page being shown", () => {
    const { session, engine, home, about } = setup();
    session.showPage(about);

    editAbout(engine, "About Webforge");

    const site = session.history.document.getState();
    expect(site.pages[about]?.doc.content[0]?.props.text).toBe("About Webforge");
    expect(site.pages[home]?.doc).toEqual(starterPage());
  });

  it("loads the page into the canvas when another page is shown, not as an undo step", () => {
    const { session, engine, about } = setup();

    session.showPage(about);

    expect(engine.loadPage).toHaveBeenLastCalledWith(
      session.history.document.getState().pages[about]?.doc,
      session.history.document.getState().layout,
      session.history.document.getState().sharedSections,
    );
    expect(session.history.entries()).toEqual([]);
  });

  it("ignores pages that don't exist and the page already shown", () => {
    const { session, engine, home } = setup();

    session.showPage(home);
    session.showPage("page-missing" as PageId);

    expect(engine.loadPage).not.toHaveBeenCalled();
    expect(session.ui.getState().pageId).toBe(home);
  });

  it("goes back to the page, element and device view of an undone edit", () => {
    const { session, engine, home, about } = setup();
    session.showPage(about);
    session.setViewport("mobile");
    engine.selectFromCanvas("about-heading");
    editAbout(engine, "Changed");
    engine.selectFromCanvas(null);
    vi.advanceTimersByTime(TEXT_SESSION_GRACE_MS);
    session.showPage(home);
    session.setViewport("desktop");

    session.history.undo();

    expect(session.ui.getState()).toEqual({
      pageId: about,
      nodeId: "about-heading",
      viewport: "mobile",
    });
    expect(engine.loadPage).toHaveBeenLastCalledWith(
      session.history.document.getState().pages[about]?.doc,
      expect.anything(),
      expect.anything(),
    );
    expect(engine.setViewport).toHaveBeenLastCalledWith("mobile");
    expect(engine.select).toHaveBeenLastCalledWith("about-heading");
  });

  it("follows a device view chosen on the canvas, not as an undo step (U6)", () => {
    const { session, engine } = setup();

    engine.switchView("tablet");

    expect(session.ui.getState().viewport).toBe("tablet");
    expect(session.history.entries()).toEqual([]);
  });

  it("keeps the restored element selected while the canvas loads the page", () => {
    const { session, engine, about } = setup();
    session.showPage(about);
    engine.selectFromCanvas("about-heading");
    editAbout(engine, "Changed");
    session.showPage(session.history.document.getState().homePageId);
    // The engine clears its selection while it loads a page.
    vi.mocked(engine.loadPage).mockImplementation(() => engine.selectFromCanvas(null));

    session.history.undo();

    expect(session.ui.getState().nodeId).toBe("about-heading");
  });

  it("ends a text session when another page is shown", () => {
    const { session, labels, typeHeading, about } = setup();
    typeHeading("A");
    vi.advanceTimersByTime(2_000);
    typeHeading("AB");

    session.showPage(about);

    expect(labels()).toEqual(["Edited Heading text"]);
  });

  it("ignores canvas edits when the page shown no longer exists", () => {
    const { session, engine, labels } = setup();
    // The page shown is taken away under the editor; nothing can show a page that isn't there.
    session.edit("props", "Removed the page shown", (draft) => {
      delete draft.pages[session.ui.getState().pageId];
    });
    session.showPage("page-gone" as PageId);

    editAbout(engine, "Lost");

    expect(labels()).toEqual(["Removed the page shown"]);
  });
});

describe("several selected elements (1.31, UX-3)", () => {
  it("adds and takes away with Ctrl/Cmd- or Shift-clicks, and outlines the others", () => {
    const { session, engine } = setup();

    engine.selectFromCanvas("heading-1");
    engine.selectFromCanvas("text-1", true);
    expect(session.ui.getState()).toMatchObject({ nodeId: "text-1", others: ["heading-1"] });
    expect(engine.showSelected).toHaveBeenLastCalledWith(["heading-1"]);
    expect(engine.select).toHaveBeenLastCalledWith("text-1");

    // The one shown, clicked again: out, the other shown instead.
    engine.selectFromCanvas("text-1", true);
    expect(session.ui.getState()).toMatchObject({ nodeId: "heading-1", others: [] });
    expect(engine.showSelected).toHaveBeenLastCalledWith([]);
    expect(engine.select).toHaveBeenLastCalledWith("heading-1");

    // A plain click ends it.
    engine.selectFromCanvas("text-1", true);
    engine.selectFromCanvas("heading-1");
    expect(session.ui.getState()).toMatchObject({ nodeId: "heading-1", others: [] });
  });

  it("restores a whole multi-selection on undo", () => {
    const { session, engine, typeHeading } = setup();
    engine.selectFromCanvas("heading-1");
    engine.selectFromCanvas("text-1", true);

    typeHeading("Welcome!", "text-1");
    engine.selectFromCanvas("heading-1");
    session.history.undo();

    expect(session.ui.getState()).toMatchObject({ nodeId: "text-1", others: ["heading-1"] });
  });
});

describe("onEntryAdded", () => {
  it("reports each new entry with its kind, but not edits merged into the current one", () => {
    const { session, engine, typeHeading } = setup();
    const added: [string, EditKind][] = [];
    const stop = session.onEntryAdded((entry, kind) => added.push([entry.label, kind]));

    typeHeading("A");
    typeHeading("AB");
    engine.edit({
      kind: "remove",
      componentType: "Section",
      page: { ...starterPage(), content: [] },
    });
    stop();
    session.history.undo();
    engine.edit({
      kind: "remove",
      componentType: "Section",
      page: { ...starterPage(), content: [] },
    });

    expect(added).toEqual([
      ["Edited Heading text", "text"],
      ["Deleted Section", "remove"],
    ]);
  });

  it("reports nothing for an edit that changes nothing", () => {
    const { session, engine, doc } = setup();
    const listener = vi.fn();
    session.onEntryAdded(listener);

    engine.edit({ kind: "move", componentType: "Heading", page: doc() });

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("runHistoryCommand", () => {
  it("undoes and redoes", () => {
    const { session, typeHeading, doc } = setup();
    typeHeading("Changed");

    expect(runHistoryCommand(session, "undo")).toBe(true);
    expect(doc()).toEqual(starterPage());
    expect(runHistoryCommand(session, "redo")).toBe(true);
    expect(doc()).toEqual(withHeadingText(starterPage(), "Changed"));
  });

  it("leaves Esc alone when no gesture is in progress", () => {
    const { session } = setup();

    expect(runHistoryCommand(session, "cancel")).toBe(false);
  });
});

describe("gestures (U2)", () => {
  const setTitle = (title: string) => (draft: SiteDoc) => {
    const home = draft.pages[draft.homePageId];
    if (home !== undefined) home.doc.root.props.title = title;
  };
  const title = (session: ReturnType<typeof setup>["session"]) =>
    currentPage(session)?.doc.root.props.title;

  it("shows updates live and records one step on commit", () => {
    const { session, labels } = setup();
    const added = vi.fn();
    session.onEntryAdded(added);

    const gesture = session.begin("props", "Changed Section padding");
    gesture.update(setTitle("a"));
    expect(title(session)).toBe("a");
    gesture.update(setTitle("ab"));
    gesture.commit();

    expect(labels()).toEqual(["Changed Section padding"]);
    expect(added).toHaveBeenCalledOnce();
    expect(added).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Changed Section padding" }),
      "props",
    );
    session.history.undo();
    expect(title(session)).toBeUndefined();
  });

  it("cancels with Esc, leaving no step and the document as it was", () => {
    const { session, engine, labels } = setup();
    const before = session.history.document.getState();
    const gesture = session.begin("props", "Changed Section padding");
    gesture.update(setTitle("a"));

    expect(engine.command("cancel")).toBe(true);

    expect(gesture.active).toBe(false);
    expect(session.history.document.getState()).toBe(before);
    expect(labels()).toEqual([]);
    expect(engine.command("cancel")).toBe(false);
  });

  it("undoes the gesture itself when Ctrl+Z comes in the middle of it", () => {
    const { session, engine, typeHeading, labels } = setup();
    typeHeading("Typed");
    const gesture = session.begin("props", "Changed Section padding");
    gesture.update(setTitle("a"));

    expect(engine.command("undo")).toBe(true);

    expect(gesture.active).toBe(false);
    expect(title(session)).toBeUndefined();
    expect(labels()).toEqual(["Edited Heading text"]);
    expect(session.history.state.getState().cursor).toBe(1);
  });

  it("ends a gesture as it is when a canvas edit or another gesture comes first", () => {
    const { session, labels, typeHeading } = setup();
    const first = session.begin("props", "First");
    first.update(setTitle("a"));

    typeHeading("Typed");
    const second = session.begin("props", "Second");
    second.update(setTitle("b"));
    session.begin("props", "Third").cancel();

    expect(first.active).toBe(false);
    expect(second.active).toBe(false);
    expect(labels()).toEqual(["First", "Edited Heading text", "Second"]);
  });

  it("records nothing for a gesture that changed nothing", () => {
    const { session, labels } = setup();
    const added = vi.fn();
    session.onEntryAdded(added);

    session.begin("props", "Nothing").commit();

    expect(labels()).toEqual([]);
    expect(added).not.toHaveBeenCalled();
  });
});
