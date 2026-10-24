import type { NodeDoc } from "@webforge/model";
import { Window } from "happy-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BEHAVIOUR_SCRIPTS } from "../behaviours.js";
import { siteLibrary } from "../catalogue/index.js";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";

// The "carousel" behaviour (2.10) on a Carousel as the export renders it.

const windows: Window[] = [];
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(async () => {
  vi.useRealTimers();
  for (const happy of windows.splice(0)) await happy.happyDOM.close();
});

const slide = (n: number): NodeDoc => ({
  type: "CarouselSlide",
  props: { id: `slide-${n}`, text: `Slide ${n}`, name: "" },
});

/** A page of its own with a Carousel of `count` slides, and `carousel.js` run on it. */
function page(props: Record<string, unknown> = {}, count = 3, reducedMotion = false) {
  const happy = new Window({ width: 1024, height: 768 });
  windows.push(happy);
  const window = happy as unknown as typeof globalThis;
  const { document } = window;
  document.body.innerHTML = renderNodesToHtml(
    [
      {
        type: "Carousel",
        props: {
          id: "carousel",
          label: "Testimonials",
          slides: Array.from({ length: count }, (_, index) => slide(index + 1)),
          ...props,
        },
      },
    ],
    siteLibrary,
    EDITOR_RENDER_CONTEXT,
  );
  Object.defineProperty(window, "matchMedia", {
    value: (query: string) => ({ matches: reducedMotion && query.includes("reduce") }),
    configurable: true,
  });
  const track = document.querySelector<HTMLElement>("[data-wf-carousel-track]");
  if (track === null) throw new Error("No track");
  const scrolled = vi.fn();
  track.scrollTo = scrolled as typeof track.scrollTo;
  new Function(
    "document",
    "window",
    "HTMLElement",
    "Node",
    "setInterval",
    "clearInterval",
    BEHAVIOUR_SCRIPTS.carousel ?? "",
  )(document, window, window.HTMLElement, window.Node, setInterval, clearInterval);
  const root = document.querySelector<HTMLElement>("[data-wf-carousel]");
  if (root === null) throw new Error("No carousel");
  const button = (name: string) => {
    const found = root.querySelector<HTMLButtonElement>(`[data-wf-carousel-${name}]`);
    if (found === null) throw new Error(`No ${name} button`);
    return found;
  };
  const status = () => root.querySelector("[data-wf-carousel-status]");
  return { document, window, root, track, button, status, scrolled };
}

describe("the carousel behaviour (2.10)", () => {
  it("names each slide for screen readers and shows its buttons", () => {
    const { root, document } = page();

    const slides = [...document.querySelectorAll(".site-carousel-slide")];
    expect(slides.map((each) => each.getAttribute("aria-label"))).toEqual([
      "1 of 3",
      "2 of 3",
      "3 of 3",
    ]);
    expect(slides[0]?.getAttribute("role")).toBe("group");
    expect(slides[0]?.getAttribute("aria-roledescription")).toBe("slide");
    expect(root.querySelector<HTMLElement>("[data-wf-carousel-controls]")?.hidden).toBe(false);
  });

  it("keeps the buttons hidden for one slide: there's nowhere to go", () => {
    const { root } = page({}, 1);

    expect(root.querySelector<HTMLElement>("[data-wf-carousel-controls]")?.hidden).toBe(true);
  });

  it("goes to the next and previous slide, round past either end, and says which shows", () => {
    const { root, button, status } = page();

    button("next").click();
    expect(root.dataset.current).toBe("1");
    expect(status()?.textContent).toBe("2 of 3");
    button("next").click();
    button("next").click();
    expect(root.dataset.current).toBe("0");
    button("previous").click();
    expect(root.dataset.current).toBe("2");
    expect(status()?.textContent).toBe("3 of 3");
  });

  it("leaves how it scrolls to the strip's CSS: smooth, or at once under reduced motion", () => {
    const { button, scrolled, track } = page({}, 3, true);

    button("next").click();
    // No `behavior`, which would override the CSS's `motion-reduce:scroll-auto`.
    expect(scrolled).toHaveBeenLastCalledWith({ left: 0 });
    expect(track.className).toContain("scroll-smooth");
    expect(track.className).toContain("motion-reduce:scroll-auto");
  });

  it("moves logos a page of what's in view at a time, the last page full", () => {
    const { root, track, document, button, status, scrolled } = page({ variant: "logos" }, 10);
    // Four in view: slides 100 px apart (84 px and a 16 px gap) in a 384 px strip, 984 px long,
    // which scrolls 600 px at most: slide 7 is the last a page can start at.
    const slides = [...document.querySelectorAll<HTMLElement>(".site-carousel-slide")];
    slides.forEach((slide, index) => {
      Object.defineProperty(slide, "offsetLeft", { value: index * 100 });
      Object.defineProperty(slide, "offsetWidth", { value: 84 });
    });
    Object.defineProperty(track, "clientWidth", { value: 384 });
    Object.defineProperty(track, "scrollWidth", { value: 984 });

    button("next").click();
    expect(root.dataset.current).toBe("4");
    expect(status()?.textContent).toBe("5 to 8 of 10");
    // Not slides 9 and 10 alone with empty space: the last four.
    button("next").click();
    expect(root.dataset.current).toBe("6");
    expect(status()?.textContent).toBe("7 to 10 of 10");
    expect(scrolled).toHaveBeenLastCalledWith(expect.objectContaining({ left: 600 }));
    button("next").click();
    expect(root.dataset.current).toBe("0");
    // Round the other way too: to the last full page, not slide 10 alone.
    button("previous").click();
    expect(root.dataset.current).toBe("6");
    expect(status()?.textContent).toBe("7 to 10 of 10");
    button("previous").click();
    expect(root.dataset.current).toBe("2");
    expect(status()?.textContent).toBe("3 to 6 of 10");
  });

  it("moves with the arrow keys while the focus is in it, not with a modifier held", () => {
    const { root, window, track } = page();
    const press = (key: string, init: KeyboardEventInit = {}) => {
      const event = new window.KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
        ...init,
      });
      track.dispatchEvent(event);
      return event.defaultPrevented;
    };

    expect(press("ArrowRight")).toBe(true);
    expect(root.dataset.current).toBe("1");
    expect(press("ArrowLeft")).toBe(true);
    expect(root.dataset.current).toBe("0");
    // Alt+Left is the browser's Back; Shift+Arrow selects text.
    for (const modifier of ["altKey", "ctrlKey", "metaKey", "shiftKey"]) {
      expect(press("ArrowRight", { [modifier]: true }), modifier).toBe(false);
    }
    expect(root.dataset.current).toBe("0");
  });

  it("follows a swipe at once after a move that had nowhere to scroll", () => {
    const { root, track, document, window, button } = page({}, 3);
    const slides = [...document.querySelectorAll<HTMLElement>(".site-carousel-slide")];
    slides.forEach((slide, index) => {
      Object.defineProperty(slide, "offsetLeft", { value: index * 100 });
    });

    // Round to the last slide, then back to the first: where the strip still is (left 0, as the
    // test's strip doesn't scroll), so no scroll will say it arrived.
    button("previous").click();
    button("next").click();
    expect(root.dataset.current).toBe("0");
    // A swipe to the second slide counts at once, though the last move was a moment ago.
    track.scrollLeft = 100;
    track.dispatchEvent(new window.Event("scroll"));
    expect(root.dataset.current).toBe("1");
  });

  describe("playing automatically", () => {
    it("moves on every interval without announcing it, until its button stops it", () => {
      const { root, button, status } = page({ autoplay: true, interval: "5" });

      expect(root.hasAttribute("data-playing")).toBe(true);
      expect(status()?.getAttribute("aria-live")).toBe("off");
      expect(button("play").getAttribute("aria-label")).toBe("Stop the slides");
      vi.advanceTimersByTime(5_000);
      expect(root.dataset.current).toBe("1");
      expect(status()?.textContent).toBe("");

      button("play").click();
      expect(root.hasAttribute("data-playing")).toBe(false);
      expect(button("play").getAttribute("aria-label")).toBe("Play the slides");
      expect(status()?.getAttribute("aria-live")).toBe("polite");
      vi.advanceTimersByTime(20_000);
      expect(root.dataset.current).toBe("1");
    });

    it("pauses while the pointer or the focus is in it", () => {
      const { root, window, track } = page({ autoplay: true, interval: "5" });

      root.dispatchEvent(new window.Event("mouseenter"));
      vi.advanceTimersByTime(10_000);
      expect(root.dataset.current).toBeUndefined();
      root.dispatchEvent(new window.Event("mouseleave"));
      vi.advanceTimersByTime(5_000);
      expect(root.dataset.current).toBe("1");

      track.dispatchEvent(new window.FocusEvent("focusin", { bubbles: true }));
      vi.advanceTimersByTime(10_000);
      expect(root.dataset.current).toBe("1");
    });

    it("starts from its button though the focus is on it", () => {
      const { root, window, button } = page({ autoplay: true, interval: "5" });

      button("play").dispatchEvent(new window.FocusEvent("focusin", { bubbles: true }));
      button("play").click();
      button("play").click();
      vi.advanceTimersByTime(5_000);
      expect(root.dataset.current).toBe("1");
    });

    it("never plays for a visitor who prefers reduced motion", () => {
      const { root, button } = page({ autoplay: true, interval: "5" }, 3, true);

      expect(root.hasAttribute("data-playing")).toBe(false);
      expect(button("play").getAttribute("aria-label")).toBe("Play the slides");
      vi.advanceTimersByTime(20_000);
      expect(root.dataset.current).toBeUndefined();
    });
  });
});
