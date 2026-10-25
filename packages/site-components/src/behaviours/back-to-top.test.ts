import { Window } from "happy-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { backToTopHtml } from "../back-to-top.js";
import { BEHAVIOUR_SCRIPTS } from "../behaviours.js";

// The "back-to-top" behaviour (F-CM-9, 2.9b) on the button as the export writes it.

const windows: Window[] = [];
afterEach(async () => {
  for (const happy of windows.splice(0)) await happy.happyDOM.close();
});

/** A page with the button, 768 px high, `back-to-top.js` run on it; less motion if `still`. */
function page({ still = false } = {}) {
  const happy = new Window({ width: 1024, height: 768 });
  windows.push(happy);
  const window = happy as unknown as typeof globalThis;
  const { document } = window;
  document.body.innerHTML = `<a href="#first">First link</a>${backToTopHtml()}`;
  window.matchMedia = ((query: string) => ({
    matches: still && query === "(prefers-reduced-motion: reduce)",
  })) as typeof window.matchMedia;
  const scrolls = vi.fn();
  window.scrollTo = scrolls as typeof window.scrollTo;
  new Function("document", "window", "HTMLElement", BEHAVIOUR_SCRIPTS["back-to-top"] ?? "")(
    document,
    window,
    window.HTMLElement,
  );
  const button = document.querySelector<HTMLElement>("[data-wf-back-to-top]");
  if (button === null) throw new Error("No back-to-top button");
  const scrollTo = (y: number) => {
    Object.defineProperty(window, "scrollY", { value: y, configurable: true });
    window.dispatchEvent(new window.Event("scroll"));
  };
  return { document, button, scrollTo, scrolls };
}

describe("the back-to-top behaviour (F-CM-9)", () => {
  it("is a link to the top named for screen readers, shown once the page has scrolled a screen", () => {
    const { button, scrollTo } = page();

    expect(button.getAttribute("href")).toBe("#");
    expect(button.getAttribute("aria-label")).toBe("Back to top");
    expect(button.hidden).toBe(true);
    scrollTo(767);
    expect(button.hidden).toBe(true);
    scrollTo(768);
    expect(button.hidden).toBe(false);
    scrollTo(0);
    expect(button.hidden).toBe(true);
  });

  it("scrolls back smoothly and gives the page the focus, so the next Tab starts at the top", () => {
    const { document, button, scrollTo, scrolls } = page();
    scrollTo(2000);
    button.focus();

    button.click();

    expect(scrolls).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    expect(document.activeElement).toBe(document.body);
    // Only while it has the focus: the page isn't left focusable.
    button.focus();
    expect(document.body.hasAttribute("tabindex")).toBe(false);
  });

  it("jumps instead for a visitor who prefers less motion", () => {
    const { button, scrollTo, scrolls } = page({ still: true });
    scrollTo(2000);

    button.click();

    expect(scrolls).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });
});
