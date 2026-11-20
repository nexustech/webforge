// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCanvasScroll, ROOM_ABOVE, ROOM_BELOW, revealOffset } from "./canvas-scroll.js";

describe("revealOffset (#1176)", () => {
  // A view 600 px tall, with 48 px kept above an element and 16 below.
  const offset = (top: number, bottom: number) => revealOffset(top, bottom, 600, 48, 16);

  it("leaves a box that shows clear of its bar where it is", () => {
    expect(offset(48, 584)).toBe(0);
    expect(offset(200, 300)).toBe(0);
  });

  it("scrolls up to a box above the view, or under its bar, keeping the bar's room", () => {
    expect(offset(-900, -800)).toBe(-948);
    expect(offset(10, 100)).toBe(-38);
  });

  it("scrolls down to a box below the view until its bottom shows", () => {
    expect(offset(1000, 1100)).toBe(516);
    expect(offset(500, 650)).toBe(66);
  });

  it("shows the top of a box taller than the view", () => {
    expect(offset(1000, 3000)).toBe(952);
    expect(offset(100, 2000)).toBe(52);
  });
});

/** Element `id`, drawn from `top` to `bottom` of the view by its first child, as Puck wraps it. */
function element(id: string, top: number, bottom: number) {
  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-puck-component", id);
  const drawn = document.createElement("section");
  drawn.getBoundingClientRect = () => new DOMRect(0, top, 800, bottom - top);
  wrapper.append(drawn);
  return wrapper;
}

describe("the canvas's scrolling (#1176)", () => {
  let scrollBy: ReturnType<typeof vi.spyOn>;
  let scrollTo: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("scrolls an element below the view up into it at once, without waiting for a frame", () => {
    document.body.append(element("text-1", 2000, 2100));
    const scroll = createCanvasScroll(() => document);

    scroll.reveal("text-1");

    expect(scrollBy).toHaveBeenCalledWith(0, 2100 - (window.innerHeight - ROOM_BELOW));
  });

  it("keeps the selection bar's room above an element under the view's top", () => {
    document.body.append(element("hero-1", 10, 300));

    createCanvasScroll(() => document).reveal("hero-1");

    expect(scrollBy).toHaveBeenCalledWith(0, 10 - ROOM_ABOVE);
  });

  it("leaves an element that shows already where it is", () => {
    document.body.append(element("text-1", 200, 300));

    createCanvasScroll(() => document).reveal("text-1");

    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("opens a page at its top, then shows the element selected on it once it is drawn", () => {
    const scroll = createCanvasScroll(() => document);

    scroll.toTop();
    scroll.reveal("text-9");
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    expect(scrollBy).not.toHaveBeenCalled();

    // The new page draws it a moment later.
    document.body.append(element("text-9", 1500, 1600));
    vi.advanceTimersByTime(16);
    expect(scrollBy).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops looking for an element that never comes, and forgets the page before's", () => {
    const scroll = createCanvasScroll(() => document);

    scroll.reveal("gone");
    vi.advanceTimersByTime(2000);
    expect(vi.getTimerCount()).toBe(0);

    // Another page shown drops an element still to show from the one before.
    scroll.reveal("old");
    scroll.toTop();
    document.body.append(element("old", 2000, 2100));
    vi.advanceTimersByTime(100);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("shows only the latest element selected while one is still to come", () => {
    const scroll = createCanvasScroll(() => document);

    scroll.reveal("new-section");
    document.body.append(element("text-1", 2000, 2100));
    scroll.reveal("text-1");
    expect(scrollBy).toHaveBeenCalledTimes(1);

    document.body.append(element("new-section", 3000, 3100));
    vi.advanceTimersByTime(100);
    expect(scrollBy).toHaveBeenCalledTimes(1);
  });

  it("does nothing without a canvas, or once cancelled", () => {
    createCanvasScroll(() => undefined).reveal("text-1");
    createCanvasScroll(() => undefined).toTop();
    expect(vi.getTimerCount()).toBe(0);

    const scroll = createCanvasScroll(() => document);
    scroll.reveal("text-1");
    scroll.cancel();
    document.body.append(element("text-1", 2000, 2100));
    vi.advanceTimersByTime(100);
    expect(scrollBy).not.toHaveBeenCalled();
  });
});
