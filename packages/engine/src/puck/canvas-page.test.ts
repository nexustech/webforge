import type { AppState, PuckAction } from "@puckeditor/core";
import type { LayoutDoc, NodeDoc, PageDoc } from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
import { describe, expect, it, vi } from "vitest";
import { createCanvasPage } from "./canvas-page.js";
import { createCanvasSelection } from "./canvas-selection.js";
import { createCanvasSync } from "./canvas-sync.js";
import type { PuckApi } from "./engine-support.js";
import { typingPauses } from "./typing-pauses.js";

const heading = (id: string, text = id): NodeDoc => ({ type: "Heading", props: { id, text } });
const pageOf = (...content: NodeDoc[]): PageDoc => ({ root: { props: {} }, content });
const NO_LAYOUT: LayoutDoc = { header: [], footer: [] };

/** A canvas page on a Puck that records what is dispatched to it, ready unless `ready` is false. */
function canvasPage(ready = true, library: ComponentLibrary | null = null) {
  const sync = createCanvasSync();
  const dispatched: PuckAction[] = [];
  const puck = { current: ready };
  // As the engine's: nothing reaches Puck before it is ready.
  const dispatch = (action: PuckAction) => {
    if (puck.current) sync.apply(() => dispatched.push(action));
  };
  const selection = createCanvasSelection(dispatch, (id) => ({
    zone: "root:default-zone",
    index: Number(id.at(-1)),
  }));
  const editorRevisions = new Map([["a", 2]]);
  const page = createCanvasPage({
    sync,
    // Only its presence is used here: Puck is ready.
    puck: () => (puck.current ? ({} as PuckApi) : null),
    dispatch,
    library: () => library,
    slotsOf: () => [],
    selection,
    commands: { edited: vi.fn() },
    pauses: typingPauses(),
    dragKeys: { copy: false, linked: false, pressed: false },
    editorRevisions,
    frameDocument: () => null,
  });
  return { page, sync, dispatched, selection, puck, editorRevisions };
}

describe("CanvasPage (R8)", () => {
  it("shows a page the app opens, whole, with nothing selected and its editors fresh", () => {
    const { page, dispatched, selection, editorRevisions } = canvasPage();
    selection.report("a");

    page.load({ page: pageOf(heading("a")), layout: NO_LAYOUT, shared: {} });

    expect(dispatched.map((action) => action.type)).toEqual(["setData", "setUi"]);
    expect(selection.current()).toBeNull();
    expect(editorRevisions.size).toBe(0);
  });

  it("puts the shared Header and Footer around the page, as Puck shows it (F-ED-7)", () => {
    const { page } = canvasPage();

    page.load({
      page: pageOf(heading("a")),
      layout: { header: [heading("h")], footer: [heading("f")] },
      shared: {},
    });

    expect(page.composed().content.map((node) => node.props.id)).toEqual(["h", "a", "f"]);
  });

  it("shows an app's change to the page as only what changed, keeping the selection", () => {
    const { page, dispatched, sync, selection } = canvasPage();
    page.load({ page: pageOf(heading("a1"), heading("b2")), layout: NO_LAYOUT, shared: {} });
    selection.select("b2");
    dispatched.length = 0;

    page.apply({
      page: pageOf(heading("a1", "New"), heading("b2")),
      layout: NO_LAYOUT,
      shared: {},
    });

    expect(dispatched.map((action) => action.type)).toEqual(["replace", "setUi"]);
    expect(sync.isShown()).toBe(true);
    expect(selection.current()).toBe("b2");
  });

  it("drops the selection when the app's change removes it", () => {
    const { page, selection } = canvasPage();
    page.load({ page: pageOf(heading("a1"), heading("b2")), layout: NO_LAYOUT, shared: {} });
    selection.select("b2");

    page.apply({ page: pageOf(heading("a1")), layout: NO_LAYOUT, shared: {} });

    expect(selection.current()).toBeNull();
  });

  it("shows nothing for the same docs, or for the echo of an edit being reported", () => {
    const { page, dispatched, sync } = canvasPage();
    const first = { page: pageOf(heading("a1")), layout: NO_LAYOUT, shared: {} };
    page.load(first);
    dispatched.length = 0;

    page.apply({ ...first });
    const echo = { page: pageOf(heading("a1", "Typed")), layout: NO_LAYOUT, shared: {} };
    sync.report(() => page.apply(echo));

    expect(dispatched).toEqual([]);
    // Taken over all the same, so the app's next change is recognised.
    expect(page.docs().page).toBe(echo.page);
  });

  it("waits for Puck to be ready, then shows the latest page whole", () => {
    const { page, dispatched, sync, puck } = canvasPage(false);

    page.apply({ page: pageOf(heading("a1")), layout: NO_LAYOUT, shared: {} });
    expect(dispatched).toEqual([]);
    expect(sync.isShown()).toBe(false);

    puck.current = true;
    page.show();
    expect(dispatched.map((action) => action.type)).toEqual(["setData"]);
    expect(sync.isShown()).toBe(true);
  });

  it("refuses a drop that puts more in a slot than it holds, reporting nothing (2.9)", async () => {
    const item = (id: string): NodeDoc => ({ type: "Item", props: { id } });
    const row = (...items: NodeDoc[]): NodeDoc => ({ type: "Row", props: { id: "row", items } });
    // A Row holds one Item at most, as a Columns holds four Columns.
    const library: ComponentLibrary = {
      components: {
        Row: {
          label: "Row",
          fields: { items: { kind: "slot", label: "Items", allow: ["Item"], max: 1 } },
          defaults: { items: [] },
          render: () => null,
        },
        Item: { label: "Item", place: "child", fields: {}, defaults: {}, render: () => null },
      },
    };
    const { page, dispatched } = canvasPage(true, library);
    page.load({ page: pageOf(row(item("one")), item("two")), layout: NO_LAYOUT, shared: {} });
    const edits: unknown[] = [];
    page.onEdit((edit) => edits.push(edit));
    dispatched.length = 0;
    const state = (content: NodeDoc[]) =>
      ({
        data: { root: { props: {} }, content },
        ui: { isDragging: false },
      }) as unknown as AppState;
    const move = {
      type: "move",
      sourceZone: "root:default-zone",
      sourceIndex: 1,
      destinationZone: "row:items",
      destinationIndex: 1,
    } as PuckAction;

    page.handleAction(
      move,
      state([row(item("one"), item("two"))]),
      state([row(item("one")), item("two")]),
    );
    await Promise.resolve();

    expect(edits).toEqual([]);
    // Puck's view is put back as the page has it.
    expect(dispatched.length).toBeGreaterThan(0);
  });

  it("refuses it on a page with a slot already over its limit elsewhere (#375)", async () => {
    const item = (id: string): NodeDoc => ({ type: "Item", props: { id } });
    const row = (id: string, ...items: NodeDoc[]): NodeDoc => ({
      type: "Row",
      props: { id, items },
    });
    const library: ComponentLibrary = {
      components: {
        Row: {
          label: "Row",
          fields: { items: { kind: "slot", label: "Items", allow: ["Item"], max: 1 } },
          defaults: { items: [] },
          render: () => null,
        },
        Item: { label: "Item", place: "child", fields: {}, defaults: {}, render: () => null },
      },
    };
    // "over" holds two Items, one more than a Row may, as an old file might.
    const before = [row("over", item("o1"), item("o2")), row("row", item("one")), item("two")];
    const { page } = canvasPage(true, library);
    page.load({ page: pageOf(...before), layout: NO_LAYOUT, shared: {} });
    const edits: unknown[] = [];
    page.onEdit((edit) => edits.push(edit));
    const state = (content: NodeDoc[]) =>
      ({
        data: { root: { props: {} }, content },
        ui: { isDragging: false },
      }) as unknown as AppState;
    const move = {
      type: "move",
      sourceZone: "root:default-zone",
      sourceIndex: 2,
      destinationZone: "row:items",
      destinationIndex: 1,
    } as PuckAction;

    page.handleAction(
      move,
      state([row("over", item("o1"), item("o2")), row("row", item("one"), item("two"))]),
      state(before),
    );
    await Promise.resolve();

    expect(edits).toEqual([]);
  });
});
