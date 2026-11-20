// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { type Box, placeBar, textLines } from "./bar-placement.js";

const box = (left: number, top: number, right: number, bottom: number): Box => ({
  left,
  top,
  right,
  bottom,
});

/** The bar's place for an element at `element` in an 800 × 600 view, with a 200 × 30 bar. */
const place = (
  element: Box,
  { own = [], parent = [] }: { own?: readonly Box[]; parent?: readonly Box[] } = {},
) =>
  placeBar({
    element,
    bar: { width: 200, height: 30 },
    view: { width: 800, height: 600 },
    gap: 4,
    ownText: () => own,
    parentText: () => parent,
  });

describe("placeBar (#1177)", () => {
  it("puts the bar above the element, at its left, when there's room", () => {
    expect(place(box(100, 200, 500, 300))).toEqual({ left: 100, top: 166 });
  });

  it("puts it below an element at the view's top, as on a Header in Mobile view", () => {
    const header = box(0, 0, 400, 60);
    expect(place(header, { own: [box(16, 20, 120, 40)] })).toEqual({ left: 0, top: 64 });
  });

  it("docks it to the view's top edge for an element taller than the view, clear of its text", () => {
    const section = box(0, -300, 800, 1200);
    expect(place(section, { own: [box(300, 100, 500, 140)] })).toEqual({ left: 0, top: 4 });
  });

  it("goes to the other corner, or the bottom edge, when the text is at the top left", () => {
    const section = box(0, -300, 800, 1200);
    expect(place(section, { own: [box(0, 0, 300, 40)] })).toEqual({ left: 600, top: 4 });
    expect(place(section, { own: [box(0, 0, 800, 40)] })).toEqual({ left: 0, top: 566 });
  });

  it("goes below a nested element when above covers its parent's text", () => {
    // A Button under a Heading, in a column with room below.
    const button = box(100, 200, 260, 240);
    expect(place(button, { parent: [box(100, 150, 500, 190)] })).toEqual({ left: 100, top: 244 });
  });

  it("stays above, over the parent's text, when below covers it too", () => {
    const button = box(100, 200, 260, 240);
    const parent = [box(100, 150, 500, 190), box(100, 250, 500, 290), box(0, 0, 800, 40)];
    expect(place(button, { parent: [...parent, box(0, 560, 800, 600)] })).toEqual({
      left: 100,
      top: 166,
    });
  });

  it("covers as little of the element's text as it can when its text fills the view", () => {
    const text = box(0, -100, 800, 900);
    const lines = [box(0, 0, 800, 300), box(0, 300, 800, 580), box(0, 590, 700, 600)];
    expect(place(text, { own: lines })).toEqual({ left: 600, top: 566 });
  });

  it("keeps the bar inside the view's sides", () => {
    expect(place(box(700, 200, 790, 300))).toEqual({ left: 600, top: 166 });
    expect(place(box(-50, 200, 100, 300))).toEqual({ left: 0, top: 166 });
  });

  it("reads no text when the bar fits above the element", () => {
    const ownText = vi.fn(() => []);
    const parentText = vi.fn(() => []);
    placeBar({
      element: box(100, 200, 500, 300),
      bar: { width: 200, height: 30 },
      view: { width: 800, height: 600 },
      gap: 4,
      ownText,
      parentText,
    });
    expect(ownText).not.toHaveBeenCalled();
    expect(parentText).toHaveBeenCalledTimes(1);
  });

  it("puts the bar at the view's top in a view shorter than it", () => {
    const placed = placeBar({
      element: box(0, 0, 100, 10),
      bar: { width: 200, height: 30 },
      view: { width: 800, height: 20 },
      gap: 4,
      ownText: () => [],
      parentText: () => [],
    });
    expect(placed).toEqual({ left: 0, top: 0 });
  });
});

describe("textLines (#1177)", () => {
  it("gives each line of the texts in an element, leaving out blank ones and the selected element's", () => {
    document.body.innerHTML =
      "<section><h2>Our menu</h2> <div data-own><p>Eggs</p></div><p>Tea</p></section>";
    const lines: Record<string, DOMRect[]> = {
      "Our menu": [new DOMRect(0, 0, 200, 30), new DOMRect(0, 30, 0, 0)],
      Eggs: [new DOMRect(0, 40, 50, 20)],
      Tea: [new DOMRect(0, 70, 40, 20), new DOMRect(0, 90, 30, 20)],
    };
    const spy = vi.spyOn(Range.prototype, "getClientRects").mockImplementation(function (
      this: Range,
    ) {
      const rects = lines[this.startContainer.textContent ?? ""] ?? [];
      return rects as unknown as DOMRectList;
    });
    const section = document.querySelector("section");
    const own = document.querySelector("[data-own]");
    if (section === null || own === null) throw new Error("no section");

    expect(textLines(section, own).map((line) => line.top)).toEqual([0, 70, 90]);
    expect(textLines(own).map((line) => line.top)).toEqual([40]);
    spy.mockRestore();
    document.body.replaceChildren();
  });
});
