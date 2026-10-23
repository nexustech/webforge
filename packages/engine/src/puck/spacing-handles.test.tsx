// @vitest-environment happy-dom

import { siteLibrary } from "@webforge/site-components";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FieldDrag } from "../canvas-engine.js";
import { boxHandleFields, SpacingHandles } from "./spacing-handles.js";

declare global {
  // Tells React that act() is available (testing without @testing-library).
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const sectionFields = boxHandleFields(siteLibrary, "Section");

let root: Root;
let host: HTMLDivElement;
let drags: FieldDrag[];

/** Shows the handles of a Section whose padding is `padding`, drawn with `style`. */
function show(padding: unknown, style = "padding: 64px 16px; margin: 0") {
  // As Puck draws it: the element inside a wrapper of its own.
  document.body.innerHTML = `<div data-puck-component="s"><section style="${style}"></section></div>`;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root.render(
      <SpacingHandles
        nodeId="s"
        fields={sectionFields}
        props={{ padding }}
        onFieldDrag={(drag) => drags.push(drag)}
      />,
    ),
  );
}

const grip = (property: string, side: string) => {
  const found = host.querySelector(`.wf-grip[data-property="${property}"][data-side="${side}"]`);
  if (!(found instanceof HTMLElement)) throw new Error(`no ${property} ${side} grip`);
  return found;
};

/** A pointer event at `y` (and `x`) with `keys` held. */
const pointer = (type: string, y: number, keys: PointerEventInit = {}, x = 0) =>
  new PointerEvent(type, { bubbles: true, pointerId: 1, clientX: x, clientY: y, ...keys });

function press(element: HTMLElement, y: number, keys: PointerEventInit = {}, x = 0) {
  act(() => {
    element.dispatchEvent(pointer("pointerdown", y, keys, x));
  });
}
function move(element: HTMLElement, y: number, keys: PointerEventInit = {}, x = 0) {
  act(() => {
    element.dispatchEvent(pointer("pointermove", y, keys, x));
  });
}
function release(element: HTMLElement, y: number) {
  act(() => {
    element.dispatchEvent(pointer("pointerup", y));
  });
}

beforeEach(() => {
  drags = [];
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
});

describe("spacing handles (1.32)", () => {
  it("gives a grip per side of padding, and margin above and below only", () => {
    show({ top: "m", bottom: "m" });

    expect(
      [...host.querySelectorAll(".wf-grip")].map(
        (each) => `${each.getAttribute("data-property")} ${each.getAttribute("data-side")}`,
      ),
    ).toEqual([
      "padding top",
      "padding right",
      "padding bottom",
      "padding left",
      "margin top",
      "margin bottom",
    ]);
    expect(boxHandleFields(siteLibrary, "Heading").map((field) => field.name)).toEqual(["margin"]);
    expect(boxHandleFields(siteLibrary, "Header")).toEqual([]);
    expect(boxHandleFields(null, "Section")).toEqual([]);
  });

  it("snaps a side to the token nearest where it is dragged, one drag from start to commit", () => {
    show({ top: "m", bottom: "m" });
    const top = grip("padding", "top");

    press(top, 100);
    // 64 px of padding and 40 px further in: Large (96 px) is nearest.
    move(top, 140);
    expect(host.querySelector(".wf-grip-readout")?.textContent).toBe("Padding Top: L");
    move(top, 141);
    release(top, 141);

    expect(drags).toEqual([
      { phase: "start", nodeId: "s", field: "padding", value: { top: "m", bottom: "m" } },
      { phase: "update", nodeId: "s", field: "padding", value: { top: "l", bottom: "m" } },
      { phase: "commit", nodeId: "s", field: "padding", value: { top: "l", bottom: "m" } },
    ]);
    expect(host.querySelector(".wf-grip-readout")).toBeNull();
  });

  it("grows padding inwards and margin outwards", () => {
    show({}, "padding: 64px 16px; margin: 0");
    const bottom = grip("padding", "bottom");
    // Up, into the section: more padding below.
    press(bottom, 200);
    move(bottom, 160);
    release(bottom, 160);
    const left = grip("padding", "left");
    // Further in from the left edge: 16 px and 20 more, Small (32 px).
    press(left, 0, {}, 10);
    move(left, 0, {}, 30);
    release(left, 0);
    const margin = grip("margin", "bottom");
    // Down, away from the section: 0 px and 70 more, Large (64 px).
    press(margin, 200);
    move(margin, 270);
    release(margin, 270);

    expect(drags.filter((drag) => drag.phase === "commit").map((drag) => drag.value)).toEqual([
      { bottom: "l" },
      { left: "s" },
      { bottom: "l" },
    ]);
  });

  it("sets the side across with Shift, and every side with Ctrl or Cmd as well", () => {
    show({ top: "m", bottom: "m" });
    const top = grip("padding", "top");

    press(top, 100);
    move(top, 100 + 64, { shiftKey: true });
    move(top, 100 + 64, { shiftKey: true, ctrlKey: true });
    move(top, 100 - 64, { shiftKey: true, metaKey: true });
    release(top, 100);

    expect(drags.map((drag) => drag.value)).toEqual([
      { top: "m", bottom: "m" },
      { top: "xl", bottom: "xl" },
      { top: "xl", right: "xl", bottom: "xl", left: "xl" },
      { top: "none", right: "none", bottom: "none", left: "none" },
      { top: "none", right: "none", bottom: "none", left: "none" },
    ]);
  });

  it("sets a side back to the element's own spacing with Alt-click, as one change", () => {
    show({ top: "m", right: "s", bottom: "m" });

    press(grip("padding", "right"), 0, { altKey: true });

    expect(drags).toEqual([
      {
        phase: "start",
        nodeId: "s",
        field: "padding",
        value: { top: "m", right: "s", bottom: "m" },
      },
      { phase: "commit", nodeId: "s", field: "padding", value: { top: "m", bottom: "m" } },
    ]);
  });

  it("cancels a drag with Esc, even with Shift held, and ignores the pointer after it", () => {
    show({ top: "m", bottom: "m" });
    const top = grip("padding", "top");
    press(top, 100);
    move(top, 160, { shiftKey: true });

    const esc = new KeyboardEvent("keydown", {
      key: "Escape",
      shiftKey: true,
      cancelable: true,
    });
    act(() => {
      window.dispatchEvent(esc);
    });
    move(top, 200);
    release(top, 200);

    expect(esc.defaultPrevented).toBe(true);
    expect(drags.map((drag) => drag.phase)).toEqual(["start", "update", "cancel"]);
    expect(drags.at(-1)?.value).toEqual({ top: "m", bottom: "m" });
    expect(host.querySelector(".wf-grip-readout")).toBeNull();
  });

  it("cancels a drag whose grips go, and drags with the main button only", () => {
    show({ top: "m", bottom: "m" });
    const top = grip("padding", "top");
    press(top, 100, { button: 2 });
    expect(drags).toEqual([]);

    press(top, 100);
    move(top, 160);
    act(() => root.unmount());
    const esc = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
    window.dispatchEvent(esc);

    expect(drags.map((drag) => drag.phase)).toEqual(["start", "update", "cancel"]);
    // Its listeners went with it.
    expect(esc.defaultPrevented).toBe(false);
    root = createRoot(host);
  });

  it("reads the value of the device the canvas shows, and an old padding as top and bottom", () => {
    show({ $responsive: { desktop: "large", mobile: { top: "s" } } });

    press(grip("padding", "left"), 0, { altKey: true });

    // The canvas is as wide as Desktop's view here.
    expect(drags[0]?.value).toEqual({ top: "l", bottom: "l" });
  });
});
