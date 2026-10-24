// @vitest-environment happy-dom

import { siteLibrary } from "@webforge/site-components";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FieldDrag } from "../canvas-engine.js";
import { anchorOf, nearestStep, WidthHandles, widthAt, widthHandleField } from "./width-handles.js";

declare global {
  // Tells React that act() is available (testing without @testing-library).
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const imageWidth = widthHandleField(siteLibrary, "Image");

describe("the width a handle sets (2.17)", () => {
  it("finds the Image's width field and each step's width", () => {
    expect(imageWidth?.name).toBe("width");
    expect(imageWidth?.steps.map((step) => [step.value, step.px])).toEqual([
      ["small", 320],
      ["medium", 448],
      ["large", 672],
      ["full", null],
    ]);
    // Elements without one get no width handles.
    expect(widthHandleField(siteLibrary, "Heading")).toBeUndefined();
  });

  it("holds an element by the side it touches, by its middle otherwise, and as aligned when full", () => {
    const column = { left: 0, right: 800 };
    expect(anchorOf({ left: 0, right: 320 }, column, "centre")).toBe("left");
    expect(anchorOf({ left: 480, right: 800 }, column, "centre")).toBe("right");
    expect(anchorOf({ left: 240, right: 560 }, column, "left")).toBe("centre");
    expect(anchorOf({ left: 0, right: 800 }, column, "right")).toBe("right");
    expect(anchorOf({ left: 0, right: 800 }, column, "centre")).toBe("centre");
  });

  it("puts the moving edge at the pointer: twice as far from the middle when centred", () => {
    const element = { left: 100, right: 500 };
    expect(widthAt("left", 420, element)).toBe(320);
    expect(widthAt("right", 180, element)).toBe(320);
    expect(widthAt("centre", 460, element)).toBe(320);
    expect(widthAt("centre", 140, element)).toBe(320);
  });

  it("snaps to the nearest step, full taking the container's width, none wider than it", () => {
    const steps = imageWidth?.steps ?? [];
    expect(nearestStep(steps, 400, 1000)?.value).toBe("medium");
    expect(nearestStep(steps, 900, 1000)?.value).toBe("full");
    // In a 500 px column, Large shows 500 px wide as Full does; the narrower step wins the tie.
    expect(nearestStep(steps, 499, 500)?.value).toBe("large");
    expect(nearestStep(steps, 10, 1000)?.value).toBe("small");
  });
});

describe("width handles (2.17)", () => {
  let root: Root;
  let host: HTMLDivElement;
  let drags: FieldDrag[];

  /** Shows the handles of an Image `left`–`right` in a column 0–800, its width `width`. */
  function show(width: unknown, left = 240, right = 560) {
    // As Puck draws it: the element inside a wrapper of its own, in its column.
    document.body.innerHTML = `<div id="column"><div data-puck-component="i"><figure></figure></div></div>`;
    const figure = document.querySelector("figure");
    const column = document.getElementById("column");
    if (figure === null || column === null) throw new Error("no figure");
    figure.getBoundingClientRect = () => new DOMRect(left, 0, right - left, 200);
    // Puck's wrapper is the figure's parent, as wide as the column.
    const wrapper = figure.parentElement;
    if (wrapper !== null) wrapper.getBoundingClientRect = () => new DOMRect(0, 0, 800, 200);
    // The outline the grips are drawn in: as wide as Puck's wrapper.
    host = document.createElement("div");
    host.getBoundingClientRect = () => new DOMRect(0, 0, 800, 200);
    document.body.append(host);
    root = createRoot(host);
    act(() =>
      root.render(
        <WidthHandles
          nodeId="i"
          field={imageWidth ?? { name: "width", label: "Width", steps: [] }}
          props={{ width, alignment: "centre" }}
          onFieldDrag={(drag) => drags.push(drag)}
        />,
      ),
    );
  }

  const grip = (side: string) => {
    const found = host.querySelector(`.wf-width-grip[data-side="${side}"]`);
    if (!(found instanceof HTMLElement)) throw new Error(`no ${side} grip`);
    return found;
  };
  const pointer = (type: string, x: number) =>
    new PointerEvent(type, { bubbles: true, pointerId: 1, clientX: x, clientY: 100 });
  const at = (element: HTMLElement, type: string, x: number) =>
    act(() => {
      element.dispatchEvent(pointer(type, x));
    });

  beforeEach(() => {
    drags = [];
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = "";
  });

  it("gives grips on both edges, and snaps a drag to the nearest width, from start to commit", () => {
    show("small");
    const right = grip("right");
    expect(grip("left")).toBeTruthy();

    at(right, "pointerdown", 560);
    // Centred: the right edge at 624 makes it 448 px wide, Medium.
    at(right, "pointermove", 624);
    at(right, "pointermove", 626);
    at(right, "pointerup", 626);

    expect(drags.map((drag) => [drag.phase, drag.value])).toEqual([
      ["start", "small"],
      ["update", "medium"],
      ["commit", "medium"],
    ]);
  });

  it("puts the grips on the element's edges, not the wider outline's (2.17)", () => {
    show("small");
    const grips = host.querySelector(".wf-width-grips");
    if (!(grips instanceof HTMLElement)) throw new Error("no grips");
    // A Small Image, 240–560 in an 800 px outline: grabbed at its edge, its width doesn't jump.
    expect([grips.style.left, grips.style.right]).toEqual(["240px", "240px"]);
  });

  it("cancels a drag with Esc, back to the width before it", () => {
    show({ $responsive: { desktop: "large" } });
    const left = grip("left");

    at(left, "pointerdown", 240);
    at(left, "pointermove", 360);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    at(left, "pointermove", 0);

    expect(drags.map((drag) => drag.phase)).toEqual(["start", "update", "cancel"]);
    expect(drags.at(-1)?.value).toBe("large");
  });
});
