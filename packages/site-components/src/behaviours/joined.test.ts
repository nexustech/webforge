import { INVERSE_THEME, type NodeDoc } from "@webforge/model";
import { Window } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";
import { BEHAVIOUR_SCRIPTS } from "../behaviours.js";
import { siteLibrary, starterLayout } from "../catalogue/index.js";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderPage } from "../render-static.js";

// The "joined" behaviour (HH-1) on a Header joined to its page's first section, as the export
// renders the page.

const windows: Window[] = [];
afterEach(async () => {
  for (const happy of windows.splice(0)) await happy.happyDOM.close();
});

/** A reversed Text section, the page's first. */
const reversed: NodeDoc = {
  type: "TextSection",
  props: { id: "story", title: "Our story", text: "<p>Since 1998.</p>", colors: "inverse" },
};

/**
 * A page whose Header, with `props`, is joined to a reversed section, with `joined.js` and then
 * `sticky.js` run on it, as `webforge.js` runs them; the Header's height is `height`.
 */
function page(props: Record<string, unknown>, height = 72) {
  const happy = new Window({ width: 1024, height: 768 });
  windows.push(happy);
  const window = happy as unknown as typeof globalThis;
  const { document } = window;
  const [header] = starterLayout("Bakery").header;
  if (header === undefined) throw new Error("No Header");
  const rendered = renderPage(
    {
      header: [{ ...header, props: { ...header.props, background: "section", ...props } }],
      content: [reversed],
      footer: [],
    },
    siteLibrary,
    EDITOR_RENDER_CONTEXT,
  );
  document.body.innerHTML = `${rendered.header}<main>${rendered.main}</main>`;
  const element = document.querySelector<HTMLElement>("[data-wf-joined]");
  if (element === null) throw new Error("No joined header");
  Object.defineProperty(element, "offsetHeight", { value: height, configurable: true });
  for (const name of ["joined", "sticky"] as const) {
    new Function("document", "window", "HTMLElement", "ResizeObserver", BEHAVIOUR_SCRIPTS[name])(
      document,
      window,
      window.HTMLElement,
      undefined,
    );
  }
  const scrollTo = (y: number) => {
    Object.defineProperty(window, "scrollY", { value: y, configurable: true });
    window.dispatchEvent(new window.Event("scroll"));
  };
  const measured = () => document.documentElement.style.getPropertyValue("--wf-header-h");
  return { element, scrollTo, measured };
}

describe("the joined behaviour (HH-1)", () => {
  it("gives the page the Header's real height, over the CSS's estimate", () => {
    const { measured } = page({ sticky: false }, 88);

    expect(measured()).toBe("88px");
  });

  it("takes the section's reversed colours off a Header that stays, once scrolled, and back at the top", () => {
    const { element, scrollTo } = page({ sticky: true });

    expect(element.getAttribute("data-theme")).toBe(INVERSE_THEME);
    scrollTo(81);
    expect(element.hasAttribute("data-scrolled")).toBe(true);
    expect(element.hasAttribute("data-theme")).toBe(false);
    scrollTo(0);
    expect(element.getAttribute("data-theme")).toBe(INVERSE_THEME);
  });

  it("measures a Header that stays only at the top, so a shrunk one leaves the section as it was", () => {
    const { element, scrollTo, measured } = page({ sticky: true, scrollStyle: "shrink" }, 80);

    scrollTo(200);
    Object.defineProperty(element, "offsetHeight", { value: 48, configurable: true });
    scrollTo(300);
    expect(measured()).toBe("80px");
    Object.defineProperty(element, "offsetHeight", { value: 80, configurable: true });
    scrollTo(0);
    expect(measured()).toBe("80px");
  });

  it("leaves the colours of a Header that doesn't stay as they are", () => {
    const { element, scrollTo } = page({ sticky: false });

    scrollTo(500);
    expect(element.getAttribute("data-theme")).toBe(INVERSE_THEME);
  });
});

/**
 * A page with an Announcement bar above a Header (with `props`) and a Whole screen Hero first, with
 * `joined.js` run on it and a ResizeObserver whose callbacks the test calls; the Hero starts
 * `top` px down the page, which the test can change.
 */
function filledPage(props: Record<string, unknown>, openedAt = 0) {
  const happy = new Window({ width: 960, height: 600 });
  windows.push(happy);
  const window = happy as unknown as typeof globalThis;
  Object.defineProperty(window, "scrollY", { value: openedAt, configurable: true });
  const { document } = window;
  const [header] = starterLayout("Bakery").header;
  if (header === undefined) throw new Error("No Header");
  const rendered = renderPage(
    {
      header: [
        { type: "AnnouncementBar", props: { id: "bar", text: "Closed on Monday" } },
        { ...header, props: { ...header.props, ...props } },
      ],
      content: [{ type: "Hero", props: { id: "hero", height: "screen", variant: "background" } }],
      footer: [],
    },
    siteLibrary,
    EDITOR_RENDER_CONTEXT,
  );
  document.body.innerHTML = `${rendered.header}<main>${rendered.main}</main>`;
  const hero = document.querySelector<HTMLElement>("[data-wf-fills]");
  if (hero === null) throw new Error("No section filling the window");
  const place = { top: 100 };
  hero.getBoundingClientRect = () => new window.DOMRect(0, place.top - window.scrollY, 960, 600);
  // The page's own box, scrolled as the window is.
  document.documentElement.getBoundingClientRect = () =>
    new window.DOMRect(0, -window.scrollY, 960, 2000);
  const watched: { readonly target: Element; readonly callback: () => void }[] = [];
  class Watch {
    readonly #callback: () => void;
    constructor(callback: () => void) {
      this.#callback = callback;
    }
    observe(target: Element) {
      watched.push({ target, callback: this.#callback });
    }
  }
  new Function("document", "window", "HTMLElement", "ResizeObserver", BEHAVIOUR_SCRIPTS.joined)(
    document,
    window,
    window.HTMLElement,
    Watch,
  );
  const scrollTo = (y: number) => {
    Object.defineProperty(window, "scrollY", { value: y, configurable: true });
    window.dispatchEvent(new window.Event("scroll"));
  };
  /** Calls the callbacks watching `target`, as its change of size would. */
  const resize = (target: Element | null) => {
    for (const entry of watched) if (entry.target === target) entry.callback();
  };
  const above = () => document.documentElement.style.getPropertyValue("--wf-above-h");
  const bar = document.querySelector("[data-wf-announcement]");
  return { place, bar, header: document.querySelector("header"), resize, scrollTo, above };
}

describe("where a section filling the window starts (#1489)", () => {
  it("gives the page the Hero's start, below a bar and the Header's band", () => {
    const { above } = filledPage({ background: "own", sticky: false });

    expect(above()).toBe("100px");
  });

  it("measures again as the bar or the Header changes size, as when the bar is closed", () => {
    const { place, bar, header, resize, above } = filledPage({ background: "own", sticky: false });

    place.top = 64;
    resize(bar);
    expect(above()).toBe("64px");
    place.top = 80;
    resize(header);
    expect(above()).toBe("80px");
  });

  it("measures on opening a page already scrolled, under a Header that stays", () => {
    const { above } = filledPage({ background: "own", sticky: true }, 500);

    expect(above()).toBe("100px");
  });

  it("measures under a joined Header too", () => {
    const { above } = filledPage({ background: "section", sticky: false });

    expect(above()).toBe("100px");
  });

  it("measures under a Header that stays only at the top, so one that shrinks changes nothing", () => {
    const { place, bar, header, resize, scrollTo, above } = filledPage({
      background: "own",
      sticky: true,
      scrollStyle: "shrink",
    });

    scrollTo(200);
    place.top = 52;
    resize(header);
    resize(bar);
    expect(above()).toBe("100px");
    place.top = 100;
    scrollTo(0);
    expect(above()).toBe("100px");
  });
});
