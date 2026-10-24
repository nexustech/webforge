// @vitest-environment happy-dom
import type { PuckAction } from "@puckeditor/core";
import type { PageDoc } from "@webforge/model";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCanvasSelection } from "./canvas-selection.js";

afterEach(() => {
  document.body.replaceChildren();
});

/** A selection whose dispatches are recorded, finding each element at index 0 of `zone-<id>`. */
function selectionWithPuck() {
  const dispatched: PuckAction[] = [];
  const selection = createCanvasSelection(
    (action) => dispatched.push(action),
    (id) => ({ zone: `zone-${id}`, index: 0 }),
  );
  const changes = vi.fn();
  selection.onChange(changes);
  return { selection, dispatched, changes };
}

const page = (...ids: string[]): PageDoc => ({
  root: { props: {} },
  content: ids.map((id) => ({ type: "Text", props: { id, text: "" } })),
});

describe("CanvasSelection (R8)", () => {
  it("reports Puck's selection to the app when it changes", () => {
    const { selection, changes } = selectionWithPuck();

    selection.report("a");
    selection.report("a");
    selection.report(null);

    expect(changes.mock.calls).toEqual([
      ["a", false],
      [null, false],
    ]);
    expect(selection.current()).toBeNull();
  });

  it("shows the app's selection in Puck, once, and none for nothing", () => {
    const { selection, dispatched, changes } = selectionWithPuck();

    selection.select("a");
    selection.select("a");
    selection.select(null);

    expect(dispatched).toEqual([
      { type: "setUi", ui: { itemSelector: { zone: "zone-a", index: 0 } } },
      { type: "setUi", ui: { itemSelector: null } },
    ]);
    // The app chose it: nothing is reported back.
    expect(changes).not.toHaveBeenCalled();
  });

  it("drops a selection the page no longer has, telling the app", () => {
    const { selection, changes } = selectionWithPuck();
    selection.report("a");

    selection.keepIn(page("a", "b"));
    expect(selection.current()).toBe("a");
    selection.keepIn(page("b"));

    expect(selection.current()).toBeNull();
    expect(changes.mock.calls.at(-1)).toEqual([null, false]);
  });

  it("reports a Ctrl-click's selection as adding, and one on the selected element too (1.31)", () => {
    document.body.innerHTML =
      '<p data-puck-component="a" id="a">A</p><p data-puck-component="b" id="b">B</p>';
    const { selection, changes } = selectionWithPuck();
    const stop = selection.watchClicks(window);
    const ctrlClick = (id: string) =>
      document
        .getElementById(id)
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true }));

    // Puck selects the element clicked after the click.
    ctrlClick("a");
    selection.report("a");
    // On the element selected already, Puck selects nothing new.
    ctrlClick("a");
    stop();

    expect(changes.mock.calls).toEqual([
      ["a", true],
      ["a", true],
    ]);
  });

  it("outlines the other selected elements and says several are selected", () => {
    document.body.innerHTML = '<p data-puck-component="b">B</p>';
    const { selection } = selectionWithPuck();
    const changed = vi.fn();
    selection.several.subscribe(changed);

    selection.showOthers(["b"], document);
    expect(selection.several.get()).toBe(true);
    selection.showOthers([], undefined);

    expect(selection.several.get()).toBe(false);
    expect(changed).toHaveBeenCalledTimes(2);
  });
});
