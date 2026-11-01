import type { PageId } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { createSelectionStore, selectedIds, withSelected, withToggled } from "./selection.js";

const HOME = "home" as PageId;
const store = () => createSelectionStore({ pageId: HOME, nodeId: null, viewport: "desktop" });

describe("the selection (1.31, UX-3)", () => {
  it("selects several elements at once, the first the one shown, each once", () => {
    const ui = store();

    ui.setState(withSelected(ui.getState(), ["b", "a", "b", "c"]), true);

    expect(ui.getState()).toMatchObject({ nodeId: "b", others: ["a", "c"] });
    expect(selectedIds(ui.getState())).toEqual(["b", "a", "c"]);
    ui.setState(withSelected(ui.getState(), []), true);
    expect(selectedIds(ui.getState())).toEqual([]);
  });

  it("adds an element with a Ctrl/Cmd- or Shift-click, or takes it out", () => {
    const ui = store();
    ui.setState({ nodeId: "a" });

    ui.setState(withToggled(ui.getState(), "b"), true);
    expect(selectedIds(ui.getState())).toEqual(["b", "a"]);
    ui.setState(withToggled(ui.getState(), "c"), true);
    expect(selectedIds(ui.getState())).toEqual(["c", "b", "a"]);
    // Out again: another, then the one shown, the next one shown instead.
    ui.setState(withToggled(ui.getState(), "b"), true);
    expect(selectedIds(ui.getState())).toEqual(["c", "a"]);
    ui.setState(withToggled(ui.getState(), "c"), true);
    expect(selectedIds(ui.getState())).toEqual(["a"]);
    ui.setState(withToggled(ui.getState(), "a"), true);
    expect(ui.getState().nodeId).toBeNull();
  });

  it("ends a multi-selection when one element or another page is selected alone", () => {
    const ui = store();
    ui.setState(withSelected(ui.getState(), ["a", "b"]), true);

    ui.setState({ nodeId: "a" });
    expect(selectedIds(ui.getState())).toEqual(["a"]);
    ui.setState(withSelected(ui.getState(), ["a", "b"]), true);
    ui.setState({ pageId: "about" as PageId, nodeId: null });
    expect(selectedIds(ui.getState())).toEqual([]);

    // Neither does the device view, which isn't a selection.
    ui.setState(withSelected(ui.getState(), ["a", "b"]), true);
    ui.setState({ viewport: "mobile" });
    expect(selectedIds(ui.getState())).toEqual(["a", "b"]);
  });

  it("lists each selected element once, whatever it is given (#259 review)", () => {
    const ui = store();

    ui.setState({ nodeId: "a", others: ["b", "a", "b", "c"] });
    expect(selectedIds(ui.getState())).toEqual(["a", "b", "c"]);
    ui.setState({ pageId: HOME, nodeId: "b", others: ["b", "c", "c"], viewport: "desktop" }, true);
    expect(selectedIds(ui.getState())).toEqual(["b", "c"]);
    ui.setState({ nodeId: null, others: ["c"] });
    expect(ui.getState().others).toEqual([]);
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
