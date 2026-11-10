import { Window } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";
import { BEHAVIOUR_SCRIPTS } from "../behaviours.js";
import { siteLibrary, starterLayout } from "../catalogue/index.js";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";
import type { NavItem } from "../schema.js";

// The "section-spy" behaviour (5.10, GA10) on a one-page site's Header as the export renders it:
// its menu's links to the page's own sections, in the row and in the small screens' menu.

const windows: Window[] = [];
afterEach(async () => {
  for (const happy of windows.splice(0)) await happy.happyDOM.close();
});

/** An IntersectionObserver the test drives: what it watches, how, and what crosses its band. */
class FakeObserver {
  static made: FakeObserver[] = [];
  readonly observed: Element[] = [];
  disconnected = false;
  constructor(
    readonly callback: (entries: { target: Element; isIntersecting: boolean }[]) => void,
    readonly options: { readonly rootMargin: string },
  ) {
    FakeObserver.made.push(this);
  }
  observe(target: Element) {
    this.observed.push(target);
  }
  disconnect() {
    this.disconnected = true;
  }
  /** Says which of `targets` now cross the band, and which don't. */
  cross(crossing: readonly Element[], leaving: readonly Element[] = []) {
    this.callback([
      ...crossing.map((target) => ({ target, isIntersecting: true })),
      ...leaving.map((target) => ({ target, isIntersecting: false })),
    ]);
  }
}

/** The menu: Home (this page), a page elsewhere, three sections here, one in a dropdown. */
const MENU: NavItem[] = [
  { id: "home", label: "Home", href: "index.html", current: true },
  { id: "about", label: "About", href: "about.html", current: false },
  { id: "services", label: "Services", href: "index.html#services", current: false },
  { id: "prices", label: "Prices", href: "index.html#prices", current: false },
  {
    id: "more",
    label: "More",
    current: false,
    children: [
      { id: "contact", label: "Contact", href: "index.html#contact", current: false },
      { id: "elsewhere", label: "Their team", href: "about.html#team", current: false },
    ],
  },
];

/**
 * The page at `url` with a Header whose menu is {@link MENU} (or `menu`), the sections it links to,
 * and `section-spy.js` run on it, with the fake observer unless `observer` is false.
 */
function page({
  url = "file:///C:/Sites/Rosa/index.html",
  menu = MENU,
  observer = true,
  scrollPadding = "",
}: {
  url?: string;
  menu?: NavItem[];
  observer?: boolean;
  scrollPadding?: string;
} = {}) {
  const happy = new Window({ url, width: 1024, height: 768 });
  windows.push(happy);
  const window = happy as unknown as typeof globalThis;
  const { document } = window;
  const [header] = starterLayout("Bakery").header;
  if (header === undefined) throw new Error("No Header");
  document.body.innerHTML = `${renderNodesToHtml([header], siteLibrary, {
    ...EDITOR_RENDER_CONTEXT,
    navigation: menu,
  })}<main>${["services", "prices", "contact", "team"]
    .map((id) => `<section id="${id}">${id}</section>`)
    .join("")}</main>`;
  document.documentElement.style.scrollPaddingTop = scrollPadding;
  FakeObserver.made = [];
  new Function(
    "document",
    "window",
    "HTMLAnchorElement",
    "Node",
    "IntersectionObserver",
    "ResizeObserver",
    BEHAVIOUR_SCRIPTS["section-spy"] ?? "",
  )(
    document,
    window,
    window.HTMLAnchorElement,
    window.Node,
    observer ? FakeObserver : undefined,
    undefined,
  );
  const section = (id: string) => {
    const found = document.getElementById(id);
    if (found === null) throw new Error(`No section ${id}`);
    return found;
  };
  /** The links marked as the section in view, by label, in the page's order. */
  const marked = () =>
    [...document.querySelectorAll('a[aria-current="location"]')].map((link) => link.textContent);
  const watching = () => {
    const last = FakeObserver.made.at(-1);
    if (last === undefined) throw new Error("No observer");
    return last;
  };
  return { window, document, section, marked, watching };
}

describe("the section-spy behaviour (5.10)", () => {
  it("marks the menu's links to the section in view, one section at a time, in both menus", () => {
    const { section, marked, watching } = page();

    expect(marked()).toEqual([]);
    watching().cross([section("services")]);
    // In the row on wide screens and in the small screens' menu.
    expect(marked()).toEqual(["Services", "Services"]);

    watching().cross([section("prices")], [section("services")]);
    expect(marked()).toEqual(["Prices", "Prices"]);
    // In a dropdown, which then looks current too (its summary's class).
    watching().cross([section("contact")], [section("prices")]);
    expect(marked()).toEqual(["Contact", "Contact"]);
  });

  it("keeps the last section marked between sections, and takes the later of two across the line", () => {
    const { section, marked, watching } = page();

    watching().cross([section("services")]);
    watching().cross([], [section("services")]);
    expect(marked()).toEqual(["Services", "Services"]);
    watching().cross([section("services"), section("prices")]);
    expect(marked()).toEqual(["Prices", "Prices"]);
  });

  it("marks the last section at the bottom of the page, however short it is", () => {
    const { window, document, marked } = page();
    Object.defineProperty(document.documentElement, "scrollHeight", {
      value: 2000,
      configurable: true,
    });
    Object.defineProperty(window, "scrollY", { value: 2000 - 768, configurable: true });

    window.dispatchEvent(new window.Event("scroll"));

    expect(marked()).toEqual(["Contact", "Contact"]);
  });

  it("watches only this page's sections, leaving the current page's and other pages' links alone", () => {
    const { document, section, watching } = page();

    expect(watching().observed).toEqual([
      section("services"),
      section("prices"),
      section("contact"),
    ]);
    watching().cross([section("team")]);
    expect(document.querySelector('a[href="about.html#team"]')?.hasAttribute("aria-current")).toBe(
      false,
    );
    expect(document.querySelector('a[href="index.html"]')?.getAttribute("aria-current")).toBe(
      "page",
    );
  });

  it("watches a band one pixel tall at the page's scroll padding, under a sticky header", () => {
    const { watching } = page({ scrollPadding: "80px" });

    expect(watching().options.rootMargin).toBe("-80px 0px -687px 0px");
  });

  it("knows its own page however its address is written: published at / or opened from disk", () => {
    const published = page({
      url: "https://rosas.example/",
      menu: [{ label: "Prices", href: "/index.html#prices", current: false }],
    });
    published.watching().cross([published.section("prices")]);
    expect(published.marked()).toEqual(["Prices", "Prices"]);

    const pretty = page({
      url: "https://rosas.example/menu",
      menu: [{ label: "Prices", href: "menu.html#prices", current: false }],
    });
    pretty.watching().cross([pretty.section("prices")]);
    expect(pretty.marked()).toEqual(["Prices", "Prices"]);
  });

  it("does nothing without IntersectionObserver, or on a page its menu doesn't link into", () => {
    expect(page({ observer: false }).marked()).toEqual([]);

    page({ menu: [{ label: "About", href: "about.html#team", current: false }] });
    expect(FakeObserver.made).toEqual([]);
  });
});
