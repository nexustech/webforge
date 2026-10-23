// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { showAlsoSelected, watchAddingClicks } from "./selection-clicks.js";

afterEach(() => {
  document.body.replaceChildren();
  document.head.replaceChildren();
});

describe("watchAddingClicks (1.31)", () => {
  it("says which element a Ctrl, Cmd or Shift-click is on, and nothing for a plain one", () => {
    document.body.innerHTML =
      '<div data-puck-component="s1"><p data-puck-component="a"><span id="inside">Hi</span></p></div>' +
      '<div data-puck-overlay><button id="chip">Delete</button></div>';
    const adding = vi.fn();
    const stop = watchAddingClicks(window, adding);
    const click = (id: string, init: MouseEventInit) =>
      document
        .getElementById(id)
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true, ...init }));

    click("inside", { ctrlKey: true });
    click("inside", { metaKey: true });
    click("inside", { shiftKey: true });
    click("inside", {});
    // The selected element's bar isn't the element.
    click("chip", { ctrlKey: true });
    stop();
    click("inside", { ctrlKey: true });

    expect(adding.mock.calls).toEqual([["a"], ["a"], ["a"], [null], [null]]);
  });

  it("takes a Ctrl-click on text not being edited, keeping the caret out of it", () => {
    document.body.innerHTML =
      '<p data-puck-component="a"><span contenteditable="true" tabindex="0" id="text">Hi</span></p>';
    const adding = vi.fn();
    const stop = watchAddingClicks(window, adding);
    const text = document.getElementById("text");
    const init = { bubbles: true, cancelable: true, ctrlKey: true };

    text?.dispatchEvent(new PointerEvent("pointerdown", init));
    const press = new MouseEvent("mousedown", init);
    text?.dispatchEvent(press);
    text?.dispatchEvent(new MouseEvent("click", init));
    stop();

    expect(press.defaultPrevented).toBe(true);
    expect(adding.mock.calls).toEqual([["a"]]);
  });

  it("leaves a Shift-click in text being edited to the text, and a key ends what a click began", () => {
    document.body.innerHTML =
      '<p data-puck-component="a"><span contenteditable="true" tabindex="0" id="text">Hi</span></p>';
    const adding = vi.fn();
    const stop = watchAddingClicks(window, adding);
    const text = document.getElementById("text");
    text?.focus();

    text?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, shiftKey: true }));
    text?.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    stop();

    expect(adding.mock.calls).toEqual([[null], [null]]);
  });
});

describe("showAlsoSelected", () => {
  it("outlines the other selected elements with one stylesheet, which it keeps up to date", () => {
    showAlsoSelected(document, ["a", 'odd"id']);
    const style = () => document.head.querySelectorAll("style[data-webforge-also-selected]");

    expect(style()).toHaveLength(1);
    expect(style()[0]?.textContent).toContain('[data-puck-component="a"]');
    expect(style()[0]?.textContent).toContain('[data-puck-component="odd\\"id"]');
    showAlsoSelected(document, []);
    expect(style()).toHaveLength(1);
    expect(style()[0]?.textContent).toBe("");
  });
});
