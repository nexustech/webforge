// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CanvasContextMenu } from "../canvas-engine.js";
import { installContextMenu } from "./context-menu.js";

let menus: CanvasContextMenu[];
let enabled: boolean;
let selected: string | null;
let stop: () => void;

beforeEach(() => {
  document.body.innerHTML =
    '<div data-puck-component="section-1"><section><div data-puck-component="heading-1">' +
    '<h2>Hi</h2><p contenteditable="true">Typo</p></div></section></div><p>outside</p>';
  menus = [];
  enabled = true;
  selected = null;
  stop = installContextMenu(document, (menu) => menus.push(menu), {
    enabled: () => enabled,
    selected: () => selected,
  });
});

afterEach(() => {
  stop();
  document.body.innerHTML = "";
});

/** A right-click on `selector`: the button going down, then the menu asked for. */
function rightClick(selector: string): MouseEvent {
  const target = document.querySelector(selector);
  target?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 2 }));
  const event = new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX: 30,
    clientY: 40,
  });
  target?.dispatchEvent(event);
  return event;
}

/** Shift+F10 or the menu key: the menu asked for on the focused element, with no pointer. */
function fromKeyboard(): MouseEvent {
  const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
  (document.activeElement ?? document.body).dispatchEvent(event);
  return event;
}

describe("installContextMenu (1.35)", () => {
  it("reports a right-click on an element, the innermost one, instead of the browser's menu", () => {
    const events = [rightClick("h2"), rightClick("section"), rightClick("body > p")];
    stop();
    rightClick("h2");

    expect(menus).toEqual([
      { nodeId: "heading-1", x: 30, y: 40 },
      { nodeId: "section-1", x: 30, y: 40 },
    ]);
    expect(events.map((event) => event.defaultPrevented)).toEqual([true, true, false]);
  });

  it("leaves the browser's menu to text being edited, not to text right-clicked first", () => {
    const text = document.querySelector<HTMLElement>("[contenteditable]");

    const notEditing = rightClick("[contenteditable]");
    text?.focus();
    const editing = rightClick("[contenteditable]");

    expect(notEditing.defaultPrevented).toBe(true);
    expect(editing.defaultPrevented).toBe(false);
    expect(menus).toHaveLength(1);
  });

  it("opens the selected element's menu from the keyboard, below it; not in text being edited", () => {
    selected = "section-1";
    const section = document.querySelector("section");
    if (section !== null) section.getBoundingClientRect = () => new DOMRect(10, 20, 300, 100);
    // A left click before it isn't a right-click.
    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));

    const onSelection = fromKeyboard();
    document.querySelector<HTMLElement>("[contenteditable]")?.focus();
    const inText = fromKeyboard();

    expect(onSelection.defaultPrevented).toBe(true);
    expect(inText.defaultPrevented).toBe(false);
    expect(menus).toEqual([{ nodeId: "section-1", x: 26, y: 120 }]);
  });

  it("leaves the keyboard's menu to the browser with nothing selected", () => {
    expect(fromKeyboard().defaultPrevented).toBe(false);
    expect(menus).toEqual([]);
  });

  it("opens no element menu in Content mode: right-clicks get the browser's own", () => {
    enabled = false;
    selected = "heading-1";

    const events = [rightClick("h2"), fromKeyboard()];

    expect(events.map((event) => event.defaultPrevented)).toEqual([false, false]);
    expect(menus).toEqual([]);
  });
});
