import type { EngineEdit } from "@webforge/engine";
import type { PageDoc } from "@webforge/model";
import { siteLibrary, starterPage } from "@webforge/site-components";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  connectEngine,
  createEditorSession,
  labelFor,
  runHistoryCommand,
  TEXT_SESSION_GRACE_MS,
} from "./editor-session.js";
import { createFakeEngine } from "./fake-engine.test-helper.js";

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

function setup() {
  const session = createEditorSession(siteLibrary, starterPage());
  const engine = createFakeEngine();
  const connection = connectEngine(engine, session);
  const doc = () => session.history.document.getState().page;
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
  return { session, engine, connection, doc, labels, typeHeading };
}

describe("labelFor", () => {
  const edit = (kind: EngineEdit["kind"], extra: Partial<EngineEdit> = {}): EngineEdit => ({
    kind,
    nodeId: "x",
    componentType: "Heading",
    field: null,
    page: starterPage(),
    selection: null,
    ...extra,
  });

  it.each([
    ["insert", {}, "Added Heading"],
    ["move", {}, "Moved Heading"],
    ["remove", {}, "Deleted Heading"],
    ["duplicate", {}, "Duplicated Heading"],
    ["text", { field: "text" }, "Edited Heading text"],
    ["props", { field: "size" }, "Changed Heading size"],
    ["props", { field: "unknown" }, "Edited page"],
    ["props", { field: null }, "Edited page"],
    ["root", { componentType: null }, "Changed page settings"],
    ["page", { componentType: null }, "Edited page"],
    ["insert", { componentType: "Custom" }, "Added Custom"],
    ["insert", { componentType: null }, "Added "],
  ] as const)("labels a %s edit %o as %s", (kind, extra, expected) => {
    expect(labelFor(edit(kind, extra), siteLibrary)).toBe(expected);
  });
});

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
    expect(session.ui.getState().selection).toBe("text-1");
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
    expect(session.history.entries()[0]?.selectionAfter).toBe("heading-1");
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

    expect(session.ui.getState().selection).toBe("heading-1");
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
