import type { PageId } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { createSelectionStore, selectElements, selectedIds, toggleSelected } from "./selection.js";

const HOME = "home" as PageId;
const store = () => createSelectionStore({ pageId: HOME, nodeId: null, viewport: "desktop" });

describe("the selection (1.31, UX-3)", () => {
  it("selects several elements at once, the first the one shown, each once", () => {
    const ui = store();

    selectElements(ui, ["b", "a", "b", "c"]);

    expect(ui.getState()).toMatchObject({ nodeId: "b", others: ["a", "c"] });
    expect(selectedIds(ui.getState())).toEqual(["b", "a", "c"]);
    selectElements(ui, []);
    expect(selectedIds(ui.getState())).toEqual([]);
  });

  it("adds an element with a Ctrl/Cmd- or Shift-click, or takes it out", () => {
    const ui = store();
    ui.setState({ nodeId: "a" });

    toggleSelected(ui, "b");
    expect(selectedIds(ui.getState())).toEqual(["b", "a"]);
    toggleSelected(ui, "c");
    expect(selectedIds(ui.getState())).toEqual(["c", "b", "a"]);
    // Out again: another, then the one shown, the next one shown instead.
    toggleSelected(ui, "b");
    expect(selectedIds(ui.getState())).toEqual(["c", "a"]);
    toggleSelected(ui, "c");
    expect(selectedIds(ui.getState())).toEqual(["a"]);
    toggleSelected(ui, "a");
    expect(ui.getState().nodeId).toBeNull();
  });

  it("ends a multi-selection when one element or another page is selected alone", () => {
    const ui = store();
    selectElements(ui, ["a", "b"]);

    ui.setState({ nodeId: "a" });
    expect(selectedIds(ui.getState())).toEqual(["a"]);
    selectElements(ui, ["a", "b"]);
    ui.setState({ pageId: "about" as PageId, nodeId: null });
    expect(selectedIds(ui.getState())).toEqual([]);

    // Neither does the device view, which isn't a selection.
    selectElements(ui, ["a", "b"]);
    ui.setState({ viewport: "mobile" });
    expect(selectedIds(ui.getState())).toEqual(["a", "b"]);
  });

  it("puts a selection back whole, as undo does", () => {
    const ui = store();
    ui.setState({ nodeId: "a" });

    ui.setState({ pageId: HOME, nodeId: "a", others: ["b"], viewport: "desktop" }, true);
    expect(selectedIds(ui.getState())).toEqual(["a", "b"]);
    ui.setState({ pageId: HOME, nodeId: "c", viewport: "desktop" }, true);
    expect(selectedIds(ui.getState())).toEqual(["c"]);
  });
});
