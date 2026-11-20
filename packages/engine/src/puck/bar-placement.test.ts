// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Box, followPlacement, placeBar, textLines } from "./bar-placement.js";

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

  it("leaves the bar of an element wholly out of view where Puck puts it", () => {
    // Above the view (the Header, scrolled to the Footer), and below it.
    expect(place(box(0, -2000, 800, -1940))).toBeNull();
    expect(place(box(0, 600, 800, 700))).toBeNull();
    expect(place(box(0, -60, 800, 1))).not.toBeNull();
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
  /** Each text's lines, as the canvas would draw them. */
  let drawn: Record<string, DOMRect[]> = {};

  beforeEach(() => {
    vi.spyOn(Range.prototype, "getClientRects").mockImplementation(function (this: Range) {
      return (drawn[this.startContainer.textContent ?? ""] ?? []) as unknown as DOMRectList;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    drawn = {};
    document.body.replaceChildren();
  });

  /** `selector`'s element, drawn over `rect`. */
  const at = (selector: string, rect: DOMRect) => {
    const element = document.querySelector(selector);
    if (element === null) throw new Error(`no ${selector}`);
    element.getBoundingClientRect = () => rect;
    return element;
  };

  it("gives each line of the texts in an element, leaving out blank ones and the selected element's", () => {
    document.body.innerHTML =
      "<section><h2>Our menu</h2> <div data-own><p>Eggs</p></div><p>Tea</p></section>";
    drawn = {
      "Our menu": [new DOMRect(0, 0, 200, 30), new DOMRect(0, 30, 0, 0)],
      Eggs: [new DOMRect(0, 40, 50, 20)],
      Tea: [new DOMRect(0, 70, 40, 20), new DOMRect(0, 90, 30, 20)],
    };
    const section = at("section", new DOMRect(0, 0, 800, 600));
    const own = at("[data-own]", new DOMRect(0, 40, 800, 20));

    expect(textLines(section, own).map((line) => line.top)).toEqual([0, 70, 90]);
    expect(textLines(own).map((line) => line.top)).toEqual([40]);
  });

  it("leaves out text no one sees: hidden, see-through, or outside the element's box", () => {
    document.body.innerHTML =
      "<section><p>Shown</p><p class='other-slide'>Next slide</p><p>Cut off</p></section>";
    drawn = {
      Shown: [new DOMRect(10, 10, 100, 20)],
      "Next slide": [new DOMRect(10, 40, 100, 20)],
      // Half outside the section, which clips it.
      "Cut off": [new DOMRect(10, 190, 100, 20), new DOMRect(10, 260, 100, 20)],
    };
    const section = at("section", new DOMRect(0, 0, 800, 200));
    const slide = document.querySelector<HTMLElement>(".other-slide");
    if (slide === null) throw new Error("no slide");
    slide.checkVisibility = () => false;

    expect(textLines(section)).toEqual([
      { left: 10, top: 10, right: 110, bottom: 30 },
      { left: 10, top: 190, right: 110, bottom: 200 },
    ]);
  });
});

describe("followPlacement (#1177)", () => {
  /** The canvas's view, 800 × 600, and its element, under a 200 × 30 bar Puck puts above it. */
  function canvas(element: DOMRect, text: DOMRect[] = []) {
    document.body.innerHTML =
      "<div data-puck-overlay><div class='bar'>Bar</div></div><div data-puck-component='a'><p>A</p></div>";
    const overlay = document.querySelector("[data-puck-overlay]");
    const bar = document.querySelector<HTMLElement>(".bar");
    const wrapper = document.querySelector("[data-puck-component]");
    if (overlay === null || bar === null || wrapper === null) throw new Error("no canvas");
    const placed = { element };
    overlay.getBoundingClientRect = () => placed.element;
    wrapper.getBoundingClientRect = () => placed.element;
    Object.defineProperty(document.documentElement, "clientWidth", {
      value: 800,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 600,
      configurable: true,
    });
    Object.defineProperty(bar, "offsetHeight", { value: 30, configurable: true });
    // Where Puck puts the bar, moved by its transform, as a browser measures it.
    const measured = vi.fn(() => {
      const [, x = "0", y = "0"] =
        /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(bar.style.transform) ?? [];
      const top = placed.element.top - 34;
      return new DOMRect(placed.element.left + Number(x), top + Number(y), 200, 30);
    });
    bar.getBoundingClientRect = measured;
    vi.spyOn(Range.prototype, "getClientRects").mockImplementation(
      () => text as unknown as DOMRectList,
    );
    return { overlay, bar, wrapper, placed, measured };
  }
  const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("moves a bar that would sit on its element's text, and keeps it there without taking the move away", async () => {
    // A Header at the view's top: no room above, so below it.
    const { overlay, bar, wrapper, measured } = canvas(new DOMRect(0, 0, 800, 60));
    const stop = followPlacement(bar, overlay, wrapper);
    await settled();
    expect(bar.style.transform).toBe("translate(0px, 98px)");

    // Placed again: measured with its move, which stays.
    window.dispatchEvent(new Event("scroll"));
    await settled();
    expect(bar.style.transform).toBe("translate(0px, 98px)");
    expect(measured).toHaveBeenCalledTimes(2);

    stop();
    expect(bar.style.transform).toBe("");
  });

  it("places once for several scrolls in a task", async () => {
    const { overlay, bar, wrapper, measured } = canvas(new DOMRect(0, 200, 800, 100));
    followPlacement(bar, overlay, wrapper);
    await settled();
    measured.mockClear();

    for (let scroll = 0; scroll < 5; scroll += 1) window.dispatchEvent(new Event("scroll"));
    await settled();
    expect(measured).toHaveBeenCalledTimes(1);
  });

  it("leaves the bar of an element out of view where Puck puts it, taking its move away", async () => {
    const { overlay, bar, wrapper, placed } = canvas(new DOMRect(0, 0, 800, 60));
    followPlacement(bar, overlay, wrapper);
    await settled();
    expect(bar.style.transform).not.toBe("");

    // Scrolled down to the Footer: the Header is above the view.
    placed.element = new DOMRect(0, -2000, 800, 60);
    window.dispatchEvent(new Event("scroll"));
    await settled();
    expect(bar.style.transform).toBe("");
  });

  it("reads the element's text once, until it changes", async () => {
    // Taller than the view: docked, over its text, so its text is read.
    const { overlay, bar, wrapper } = canvas(new DOMRect(0, -100, 800, 1000), [
      new DOMRect(0, 0, 300, 40),
    ]);
    followPlacement(bar, overlay, wrapper);
    await settled();
    const reads = vi.mocked(Range.prototype.getClientRects).mock.calls.length;
    expect(reads).toBeGreaterThan(0);

    window.dispatchEvent(new Event("scroll"));
    await settled();
    expect(vi.mocked(Range.prototype.getClientRects).mock.calls.length).toBe(reads);

    wrapper.querySelector("p")?.append("B");
    await settled();
    await settled();
    expect(vi.mocked(Range.prototype.getClientRects).mock.calls.length).toBeGreaterThan(reads);
  });
});
