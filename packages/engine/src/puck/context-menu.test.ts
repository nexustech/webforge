// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from "vitest";
import type { CanvasContextMenu } from "../canvas-engine.js";
import { installContextMenu } from "./context-menu.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("installContextMenu (1.35)", () => {
  it("reports a right-click on an element, the innermost one, instead of the browser's menu", () => {
    document.body.innerHTML =
      '<div data-puck-component="section-1"><section><div data-puck-component="heading-1">' +
      '<h2>Hi</h2><p contenteditable="true">Typo</p></div></section></div><p>outside</p>';
    const menus: CanvasContextMenu[] = [];
    const stop = installContextMenu(document, (menu) => menus.push(menu));
    const click = (selector: string) => {
      const event = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: 30,
        clientY: 40,
      });
      document.querySelector(selector)?.dispatchEvent(event);
      return event;
    };

    const onHeading = click("h2");
    const onSection = click("section");
    const outside = click("body > p");
    // Editable text not being edited yet: the element's menu, as anywhere on it.
    const notEditing = click("[contenteditable]");
    // Text being edited before the right-click keeps the browser's menu, with its spelling
    // suggestions.
    const text = document.querySelector<HTMLElement>("[contenteditable]");
    text?.focus();
    text?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 2 }));
    const editing = click("[contenteditable]");
    stop();
    click("h2");

    expect(menus).toEqual([
      { nodeId: "heading-1", x: 30, y: 40 },
      { nodeId: "section-1", x: 30, y: 40 },
      { nodeId: "heading-1", x: 30, y: 40 },
    ]);
    expect(
      [onHeading, onSection, outside, notEditing, editing].map((event) => event.defaultPrevented),
    ).toEqual([true, true, false, true, false]);
  });
});
