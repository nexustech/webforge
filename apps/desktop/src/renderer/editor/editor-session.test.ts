import type { PageDoc, PageId, SiteDoc } from "@webforge/model";
import { siteLibrary, starterPage } from "@webforge/site-components";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  connectEngine,
  createEditorSession,
  currentPage,
  type EditKind,
  runHistoryCommand,
  TEXT_SESSION_GRACE_MS,
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
  const typeHeading = (text: string, selection: string | null = "heading-1") =>
    engine.edit({
      kind: "text",
      nodeId: "heading-1",
      componentType: "Heading",
      field: "text",
      page: withHeadingText(doc(), text),
      selection,
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
    session.ui.setState({ viewport: "mobile" });
    engine.selectFromCanvas("about-heading");
    editAbout(engine, "Changed");
    engine.selectFromCanvas(null);
    vi.advanceTimersByTime(TEXT_SESSION_GRACE_MS);
    session.showPage(home);
    session.ui.setState({ viewport: "desktop" });

    session.history.undo();

    expect(session.ui.getState()).toEqual({
      pageId: about,
      nodeId: "about-heading",
      viewport: "mobile",
    });
    expect(engine.loadPage).toHaveBeenLastCalledWith(
      session.history.document.getState().pages[about]?.doc,
      expect.anything(),
    );
    expect(engine.setViewport).toHaveBeenLastCalledWith("mobile");
    expect(engine.select).toHaveBeenLastCalledWith("about-heading");
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
    const { session, engine } = setup();
    session.ui.setState({ pageId: "page-gone" as PageId });

    editAbout(engine, "Lost");

    expect(session.history.entries()).toEqual([]);
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

    runHistoryCommand(session.history, "undo");
    expect(doc()).toEqual(starterPage());
    runHistoryCommand(session.history, "redo");
    expect(doc()).toEqual(withHeadingText(starterPage(), "Changed"));
  });
});
