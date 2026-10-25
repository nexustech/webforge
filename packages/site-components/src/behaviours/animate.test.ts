import { Window } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";
import { BEHAVIOUR_SCRIPTS } from "../behaviours.js";

// The "animate" behaviour (2.12, F-DS-5) on a page of three sections with an entrance: the first
// in view as the page loads, the others below it.

const windows: Window[] = [];
afterEach(async () => {
  for (const happy of windows.splice(0)) await happy.happyDOM.close();
});

type Watcher = {
  readonly callback: (entries: { target: Element; isIntersecting: boolean }[]) => void;
  readonly observed: Set<Element>;
  readonly options: IntersectionObserverInit | undefined;
  /** Whether the page was marked when the observer was made. */
  readonly markedFirst: boolean;
  /** The sections shown when the observer was made. */
  readonly shownFirst: readonly string[];
};

/**
 * Runs `animate.js` on the page; `reduced` for a visitor who prefers less motion, `loading` with
 * the site's stylesheet still loading.
 */
function page({ reduced = false, observer = true, loading = false } = {}) {
  const happy = new Window({ width: 1024, height: 768 });
  windows.push(happy);
  const window = happy as unknown as typeof globalThis;
  const { document } = window;
  document.body.innerHTML = ["top", "middle", "bottom"]
    .map((id) => `<section id="${id}" data-wf-entrance="fade"></section>`)
    .join("");
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  Object.defineProperty(stylesheet, "sheet", { value: loading ? null : {}, configurable: true });
  document.head.append(stylesheet);
  ["top", "middle", "bottom"].forEach((id, index) => {
    const section = document.getElementById(id);
    if (section !== null) {
      section.getBoundingClientRect = () => new window.DOMRect(0, index * 900, 1024, 600);
    }
  });
  window.matchMedia = ((query: string) => ({
    matches: reduced && query.includes("reduce"),
  })) as typeof window.matchMedia;
  const watchers: Watcher[] = [];
  class FakeObserver {
    constructor(callback: Watcher["callback"], options?: IntersectionObserverInit) {
      watchers.push({
        callback,
        observed: this.observed,
        options,
        markedFirst: document.documentElement.hasAttribute("data-wf-animate"),
        shownFirst: [...document.querySelectorAll("[data-wf-shown]")].map((each) => each.id),
      });
    }
    readonly observed = new Set<Element>();
    observe(target: Element) {
      this.observed.add(target);
    }
    unobserve(target: Element) {
      this.observed.delete(target);
    }
  }
  new Function(
    "document",
    "window",
    "HTMLElement",
    "HTMLLinkElement",
    "IntersectionObserver",
    BEHAVIOUR_SCRIPTS.animate ?? "",
  )(
    document,
    window,
    window.HTMLElement,
    window.HTMLLinkElement,
    observer ? FakeObserver : undefined,
  );
  const shown = () => [...document.querySelectorAll("[data-wf-shown]")].map((each) => each.id);
  const done = () => [...document.querySelectorAll("[data-wf-done]")].map((each) => each.id);
  const marked = () => document.documentElement.hasAttribute("data-wf-animate");
  return { window, document, watchers, shown, done, marked, stylesheet };
}

describe("entrance animations on the exported page (2.12, F-DS-5)", () => {
  it("shows what is already in view before marking the page, so it never disappears", () => {
    const { watchers, shown, done, marked, document } = page();

    expect(marked()).toBe(true);
    expect(shown()).toEqual(["top"]);
    // Shown without moving: done at once, so it has no delay.
    expect(done()).toEqual(["top"]);
    const [watcher] = watchers;
    // The page was marked after the first section was shown, and only the others wait.
    expect(watcher?.markedFirst).toBe(true);
    expect(watcher?.shownFirst).toEqual(["top"]);
    expect([...(watcher?.observed ?? [])].map((each) => each.id)).toEqual(["middle", "bottom"]);
    // Sliding in can't widen the page.
    expect(document.documentElement.style.overflowX).toBe("clip");
  });

  it("shows each of the others once, as soon as any of it scrolls into view", () => {
    const { watchers, shown, document } = page();
    const [watcher] = watchers;
    const middle = document.getElementById("middle");
    if (watcher === undefined || middle === null) throw new Error("not set up");

    // No margin into the view: what ends the page, never far up it, still comes in (#382 review).
    expect(watcher.options?.rootMargin).toBeUndefined();
    expect(watcher.options?.threshold).toBe(0);
    watcher.callback([{ target: middle, isIntersecting: false }]);
    expect(shown()).toEqual(["top"]);
    watcher.callback([{ target: middle, isIntersecting: true }]);

    expect(shown()).toEqual(["top", "middle"]);
    expect(watcher.observed.has(middle)).toBe(false);
  });

  it("ends an element's delay once it has moved in, so later changes don't wait", () => {
    const { window, watchers, done, document } = page();
    const [watcher] = watchers;
    const middle = document.getElementById("middle");
    const inside = document.createElement("span");
    middle?.append(inside);
    if (watcher === undefined || middle === null) throw new Error("not set up");
    watcher.callback([{ target: middle, isIntersecting: true }]);
    expect(done()).toEqual(["top"]);

    // Not for a transition inside it.
    inside.dispatchEvent(new window.Event("transitionend", { bubbles: true }));
    expect(done()).toEqual(["top"]);
    middle.dispatchEvent(new window.Event("transitionend", { bubbles: true }));

    expect(done()).toEqual(["top", "middle"]);
  });

  it("shows everything for printing", () => {
    const { window, shown } = page();

    window.dispatchEvent(new window.Event("beforeprint"));

    expect(shown()).toEqual(["top", "middle", "bottom"]);
  });

  it("measures what is in view only once the stylesheet has loaded (#382 CI, WebKit)", () => {
    const { window, watchers, shown, marked, stylesheet } = page({ loading: true });

    // Unstyled, the page is short: nothing is measured, marked or hidden yet.
    expect(marked()).toBe(false);
    expect(watchers).toEqual([]);
    stylesheet.dispatchEvent(new window.Event("load"));

    expect(marked()).toBe(true);
    expect(shown()).toEqual(["top"]);
    expect(watchers).toHaveLength(1);
  });

  it("does nothing for a visitor who prefers less motion, or without an observer", () => {
    for (const options of [{ reduced: true }, { observer: false }]) {
      const { marked, shown, watchers } = page(options);

      expect(marked()).toBe(false);
      expect(shown()).toEqual([]);
      expect(watchers).toEqual([]);
    }
  });
});
