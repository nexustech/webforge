import { copiedNodeId, type PageDoc } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it, vi } from "vitest";
import { saveAsSharedSection } from "../shared-sections/shared-sections.js";
import { createEditorSession, currentPage, runHistoryCommand } from "./editor-session.js";
import { createFakeEngine } from "./fake-engine.test-helper.js";
import { connectFieldDrags } from "./field-drag.js";
import { starterSite } from "./starter-site.js";

function setup() {
  const session = createEditorSession(siteLibrary, starterSite());
  const engine = createFakeEngine();
  const flush = vi.fn();
  const stop = connectFieldDrags(engine, session, flush);
  const labels = () => session.history.entries().map((entry) => entry.label);
  const section = () => currentPage(session)?.doc.content[0]?.props;
  const heading = () => (section()?.content as PageDoc["content"] | undefined)?.[0]?.props;
  /** One drag of `field` of `nodeId` through `values`, ended with `end`. */
  const drag = (
    nodeId: string,
    field: string,
    values: readonly unknown[],
    end: "commit" | "cancel" = "commit",
  ) => {
    engine.dragField({ phase: "start", nodeId, field, value: {} });
    for (const value of values) engine.dragField({ phase: "update", nodeId, field, value });
    engine.dragField({ phase: end, nodeId, field, value: values.at(-1) ?? {} });
  };
  return { session, engine, flush, stop, labels, section, heading, drag };
}

describe("connectFieldDrags (1.32)", () => {
  it("records a drag as one step, shown live, labelled as the Edit panel labels it", () => {
    const { session, engine, flush, labels, section, drag } = setup();
    const before = section()?.padding;

    engine.dragField({ phase: "start", nodeId: "section-1", field: "padding", value: before });
    engine.dragField({
      phase: "update",
      nodeId: "section-1",
      field: "padding",
      value: { top: "l", bottom: "m" },
    });
    // Shown while the drag goes on, before it is let go.
    expect(section()?.padding).toEqual({ top: "l", bottom: "m" });
    expect(labels()).toEqual([]);
    engine.dragField({
      phase: "commit",
      nodeId: "section-1",
      field: "padding",
      value: { top: "xl", bottom: "m" },
    });

    expect(section()?.padding).toEqual({ top: "xl", bottom: "m" });
    expect(labels()).toEqual(["Changed Section padding"]);
    expect(flush).toHaveBeenCalled();
    expect(session.history.entries()[0]?.selectionAfter.nodeId).toBe("section-1");

    drag("heading-1", "margin", [{ bottom: "s" }]);
    expect(labels()).toEqual(["Changed Section padding", "Changed Heading margin"]);
    session.history.undo();
    session.history.undo();
    expect(section()?.padding).toEqual(before);
  });

  it("sets the value of the device the canvas shows, named in the label", () => {
    const { session, labels, section, drag } = setup();
    session.ui.setState({ viewport: "mobile" });

    drag("section-1", "padding", [{ top: "s", bottom: "m" }]);

    expect(section()?.padding).toEqual({
      $responsive: { desktop: { top: "m", bottom: "m" }, mobile: { top: "s", bottom: "m" } },
    });
    expect(labels()).toEqual(["Changed Section padding on Mobile"]);
  });

  it("leaves no step for a cancelled drag, and the value as it was", () => {
    const { labels, section, drag } = setup();
    const before = section()?.padding;

    drag("section-1", "padding", [{ top: "xl" }, { top: "l" }], "cancel");

    expect(section()?.padding).toEqual(before);
    expect(labels()).toEqual([]);
  });

  it("stops when Esc cancels the gesture elsewhere, and ignores what comes after", () => {
    const { session, engine, labels, section } = setup();
    const before = section()?.padding;
    engine.dragField({ phase: "start", nodeId: "section-1", field: "padding", value: before });
    engine.dragField({ phase: "update", nodeId: "section-1", field: "padding", value: {} });

    runHistoryCommand(session, "cancel");
    engine.dragField({ phase: "update", nodeId: "section-1", field: "padding", value: {} });
    engine.dragField({ phase: "commit", nodeId: "section-1", field: "padding", value: {} });

    expect(section()?.padding).toEqual(before);
    expect(labels()).toEqual([]);
  });

  it("ignores values the field can't hold, drags of other fields and unknown elements", () => {
    const { engine, labels, section, drag } = setup();
    const before = section()?.padding;

    drag("section-1", "padding", [{ top: "huge" }, "large"]);
    expect(section()?.padding).toEqual(before);
    drag("nowhere", "padding", [{ top: "s" }]);
    drag("section-1", "nothing", [{ top: "s" }]);
    engine.dragField({ phase: "update", nodeId: "section-1", field: "padding", value: {} });

    expect(section()?.padding).toEqual(before);
    expect(labels()).toEqual([]);
  });

  it("changes an element of a linked copy in its shared section (F-ED-23)", () => {
    const { session, labels, drag } = setup();
    session.ui.setState({ nodeId: "section-1" });
    saveAsSharedSection(session, "Welcome");
    const [shared] = Object.values(session.history.document.getState().sharedSections);
    if (shared === undefined) throw new Error("not saved");
    const copyId = currentPage(session)?.doc.content[0]?.props.id ?? "";

    drag(copiedNodeId(copyId, "heading-1"), "margin", [{ top: "l" }]);

    const section = session.history.document.getState().sharedSections[shared.id]?.section;
    const content = section?.props.content as PageDoc["content"] | undefined;
    expect(content?.[0]?.props.margin).toEqual({ top: "l" });
    expect(labels().at(-1)).toBe("Edited shared section 'Welcome'");
  });

  it("drops a drag that never ended when the next one starts", () => {
    const { engine, labels, section, drag } = setup();
    const before = section()?.padding;
    engine.dragField({ phase: "start", nodeId: "section-1", field: "padding", value: before });
    engine.dragField({ phase: "update", nodeId: "section-1", field: "padding", value: {} });

    drag("heading-1", "margin", [{ top: "s" }]);

    expect(section()?.padding).toEqual(before);
    expect(labels()).toEqual(["Changed Heading margin"]);
  });

  it("stops listening when disconnected", () => {
    const { stop, labels, drag } = setup();
    stop();

    drag("section-1", "padding", [{ top: "s" }]);

    expect(labels()).toEqual([]);
  });
});
