import type { Data, PuckAction } from "@puckeditor/core";
import type { NodeDoc, PageDoc } from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import { editFromAction, type PuckState, selectedNodeId, toPageDoc } from "./edit-from-action.js";

const library: ComponentLibrary = {
  components: {
    Section: {
      label: "Section",
      fields: { content: { kind: "slot", label: "Content" } },
      defaults: {},
      render: () => null,
    },
    Heading: {
      label: "Heading",
      fields: {
        text: { kind: "text", label: "Text" },
        size: { kind: "select", label: "Size", options: [] },
      },
      defaults: {},
      render: () => null,
    },
  },
};

const heading = (id: string, text = id): NodeDoc => ({ type: "Heading", props: { id, text } });

function state(content: NodeDoc[], selected: PuckState["ui"]["itemSelector"] = null): PuckState {
  return { data: { root: { props: {} }, content } as Data, ui: { itemSelector: selected } };
}

const ROOT = "root:default-zone";

describe("editFromAction", () => {
  const before = state([heading("a"), heading("b")]);

  it("ignores actions that leave the page unchanged", () => {
    const action: PuckAction = { type: "setUi", ui: { itemSelector: { index: 0 } } };
    const next = { ...before, ui: { itemSelector: { index: 0 } } };

    expect(editFromAction(action, next, before, library)).toBeNull();
  });

  it("reports an inserted element and the new selection", () => {
    const next = state([heading("a"), heading("new"), heading("b")], { index: 1, zone: ROOT });
    const action: PuckAction = {
      type: "insert",
      componentType: "Heading",
      destinationIndex: 1,
      destinationZone: ROOT,
    };

    expect(editFromAction(action, next, before, library)).toMatchObject({
      kind: "insert",
      nodeId: "new",
      componentType: "Heading",
      field: null,
      selection: "new",
    });
  });

  it("reports moves and reorders as moves, with the moved element selected", () => {
    // Puck's positional selection still points at index 0, now the other element.
    const next = state([heading("b"), heading("a")], { index: 0, zone: ROOT });
    const move: PuckAction = {
      type: "move",
      sourceIndex: 0,
      sourceZone: ROOT,
      destinationIndex: 1,
      destinationZone: ROOT,
    };
    const reorder: PuckAction = {
      type: "reorder",
      sourceIndex: 0,
      destinationIndex: 1,
      destinationZone: ROOT,
    };

    expect(editFromAction(move, next, before, library)).toMatchObject({
      kind: "move",
      nodeId: "a",
      selection: "a",
    });
    expect(editFromAction(reorder, next, before, library)).toMatchObject({ kind: "move" });
  });

  it("reports the copy made by duplicate", () => {
    const next = state([heading("a"), heading("copy", "a"), heading("b")]);
    const action: PuckAction = { type: "duplicate", sourceIndex: 0, sourceZone: ROOT };

    expect(editFromAction(action, next, before, library)).toMatchObject({
      kind: "duplicate",
      nodeId: "copy",
    });
  });

  it("reports the removed element from the previous page", () => {
    const next = state([heading("b")]);
    const action: PuckAction = { type: "remove", index: 0, zone: ROOT };

    expect(editFromAction(action, next, before, library)).toMatchObject({
      kind: "remove",
      nodeId: "a",
      componentType: "Heading",
    });
  });

  it("reports a changed text field as a text edit", () => {
    const changed = heading("a", "New text");
    const next = state([changed, heading("b")]);
    const action: PuckAction = {
      type: "replace",
      destinationIndex: 0,
      destinationZone: ROOT,
      data: changed,
    };

    expect(editFromAction(action, next, before, library)).toMatchObject({
      kind: "text",
      nodeId: "a",
      field: "text",
      patch: { nodeId: "a", field: "text", value: "New text" },
    });
  });

  it("reports other changed fields as property edits", () => {
    const changed: NodeDoc = { type: "Heading", props: { id: "a", text: "a", size: "large" } };
    const next = state([changed, heading("b")]);
    const action: PuckAction = {
      type: "replace",
      destinationIndex: 0,
      destinationZone: ROOT,
      data: changed,
    };

    expect(editFromAction(action, next, before, library)).toMatchObject({
      kind: "props",
      field: "size",
      patch: { nodeId: "a", field: "size", value: "large" },
    });
  });

  it.each([
    ["two fields", { text: "New", size: "large" }],
    ["a list", { text: ["a", "b"] }],
    ["an object", { text: { html: "<b>a</b>" } }],
    ["a removed field", { text: undefined }],
  ])("leaves out the patch when a replace changes %s", (_, props) => {
    const changed: NodeDoc = { type: "Heading", props: { id: "a", ...props } };
    const next = state([changed, heading("b")]);
    const action: PuckAction = {
      type: "replace",
      destinationIndex: 0,
      destinationZone: ROOT,
      data: changed,
    };

    expect(editFromAction(action, next, before, library)).not.toHaveProperty("patch");
  });

  it("reports patches for elements in nested slots", () => {
    const section = (text: string): NodeDoc => ({
      type: "Section",
      props: { id: "s", content: [heading("a", text)] },
    });
    const changed = heading("a", "Nested");
    const action: PuckAction = {
      type: "replace",
      destinationIndex: 0,
      destinationZone: "s:content",
      data: changed,
    };

    expect(
      editFromAction(action, state([section("Nested")]), state([section("a")]), library),
    ).toMatchObject({ kind: "text", patch: { nodeId: "a", field: "text", value: "Nested" } });
  });

  it("reports page settings changes", () => {
    const next: PuckState = {
      data: { root: { props: { title: "About" } }, content: before.data.content },
      ui: before.ui,
    };
    const action: PuckAction = { type: "replaceRoot", root: { props: { title: "About" } } };

    expect(editFromAction(action, next, before, library)).toMatchObject({
      kind: "root",
      nodeId: null,
      field: "title",
    });
  });

  it("reports unexpected page changes as generic page edits", () => {
    const next = state([heading("a")]);
    const action: PuckAction = { type: "set", state: {} };

    expect(editFromAction(action, next, before, library)).toMatchObject({ kind: "page" });
  });

  it("finds elements in nested slots", () => {
    const section = (content: NodeDoc[]): NodeDoc => ({
      type: "Section",
      props: { id: "s", content },
    });
    const prev = state([section([heading("a")])]);
    const next = state([section([heading("a"), heading("n")])], { index: 1, zone: "s:content" });
    const action: PuckAction = {
      type: "insert",
      componentType: "Heading",
      destinationIndex: 1,
      destinationZone: "s:content",
    };

    expect(editFromAction(action, next, prev, library)).toMatchObject({
      nodeId: "n",
      selection: "n",
    });
  });
});

describe("toPageDoc", () => {
  it("keeps Puck's objects so unchanged parts stay identical", () => {
    const data = { root: { props: { a: 1 } }, content: [heading("a")] } as Data;

    const doc = toPageDoc(data);

    expect(doc.root).toBe(data.root);
    expect(doc.content).toBe(data.content);
  });

  it("fills in missing parts and drops legacy zones", () => {
    const doc: PageDoc = toPageDoc({ zones: {} } as Partial<Data>);

    expect(doc).toEqual({ root: { props: {} }, content: [] });
  });
});

describe("selectedNodeId", () => {
  it("returns null without a selection or for a stale one", () => {
    expect(selectedNodeId(state([heading("a")]))).toBeNull();
    expect(selectedNodeId(state([heading("a")], { index: 5 }))).toBeNull();
  });

  it("defaults to the page's top level", () => {
    expect(selectedNodeId(state([heading("a"), heading("b")], { index: 1 }))).toBe("b");
  });
});
