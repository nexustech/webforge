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
  /** Lets the microtasks queued so far run: React's drawing of a change, then the first look. */
  const drawn = () => Promise.resolve();

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

  it("scrolls an element below the view up into it once the change is drawn, without a frame", async () => {
    document.body.append(element("text-1", 2000, 2100));
    const scroll = createCanvasScroll(() => document);

    scroll.reveal("text-1");
    expect(scrollBy).not.toHaveBeenCalled();
    await drawn();

    expect(scrollBy).toHaveBeenCalledWith(0, 2100 - (window.innerHeight - ROOM_BELOW));
  });

  it("measures an element where the change that selected it draws it, not where it was", async () => {
    // An undo moves a section back two places and selects it: React draws the move after the app
    // has asked for the reveal, in a microtask queued first.
    const section = element("section-1", 1500, 1900);
    document.body.append(section);
    const scroll = createCanvasScroll(() => document);

    queueMicrotask(() => {
      section.replaceWith(element("section-1", 700, 1100));
    });
    scroll.reveal("section-1");
    await drawn();

    expect(scrollBy).toHaveBeenCalledWith(0, 1100 - (window.innerHeight - ROOM_BELOW));
  });

  it("keeps the selection bar's room above an element under the view's top", async () => {
    document.body.append(element("hero-1", 10, 300));

    createCanvasScroll(() => document).reveal("hero-1");
    await drawn();

    expect(scrollBy).toHaveBeenCalledWith(0, 10 - ROOM_ABOVE);
  });

  it("leaves an element that shows already where it is", async () => {
    document.body.append(element("text-1", 200, 300));

    createCanvasScroll(() => document).reveal("text-1");
    await drawn();

    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("opens a page at its top at once, then shows the element selected on it once it is drawn", async () => {
    const scroll = createCanvasScroll(() => document);

    scroll.toTop();
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    scroll.reveal("text-9");
    await drawn();
    expect(scrollBy).not.toHaveBeenCalled();

    // The new page draws it a moment later.
    document.body.append(element("text-9", 1500, 1600));
    vi.advanceTimersByTime(16);
    expect(scrollBy).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops looking for an element that never comes, and forgets the page before's", async () => {
    const scroll = createCanvasScroll(() => document);

    scroll.reveal("gone");
    await drawn();
    vi.advanceTimersByTime(2000);
    expect(vi.getTimerCount()).toBe(0);

    // Another page shown drops an element still to show from the one before.
    scroll.reveal("old");
    scroll.toTop();
    document.body.append(element("old", 2000, 2100));
    await drawn();
    vi.advanceTimersByTime(100);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("shows only the latest element selected", async () => {
    const scroll = createCanvasScroll(() => document);
    document.body.append(element("text-1", 2000, 2100));

    // Before the first one's first look, and while an earlier one is still to come.
    scroll.reveal("text-1");
    scroll.reveal("new-section");
    await drawn();
    expect(scrollBy).not.toHaveBeenCalled();
    scroll.reveal("text-1");
    await drawn();
    expect(scrollBy).toHaveBeenCalledTimes(1);

    document.body.append(element("new-section", 3000, 3100));
    vi.advanceTimersByTime(100);
    expect(scrollBy).toHaveBeenCalledTimes(1);
  });

  it("does nothing without a canvas, or once cancelled", async () => {
    createCanvasScroll(() => undefined).reveal("text-1");
    createCanvasScroll(() => undefined).toTop();
    await drawn();
    expect(vi.getTimerCount()).toBe(0);

    document.body.append(element("text-1", 2000, 2100));
    const scroll = createCanvasScroll(() => document);
    scroll.reveal("text-1");
    scroll.cancel();
    await drawn();
    vi.advanceTimersByTime(100);
    expect(scrollBy).not.toHaveBeenCalled();
  });
});
