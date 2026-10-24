import { Window } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";
import { BEHAVIOUR_SCRIPTS } from "../behaviours.js";
import { siteLibrary, starterLayout } from "../catalogue/index.js";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";
import type { RenderContext } from "../schema.js";

// The "menu" behaviour (F-ED-17, 2.6) on the Header as the export renders it: the menu on small
// screens and the dropdowns in it, each a <details> that works without the script, which the
// script makes close as a menu should.

const CONTEXT: RenderContext = {
  ...EDITOR_RENDER_CONTEXT,
  navigation: [
    { id: "home", label: "Home", href: "index.html", current: true },
    {
      id: "services",
      label: "Services",
      current: false,
      children: [
        { id: "cakes", label: "Cakes", href: "cakes.html", current: false },
        { id: "bread", label: "Bread", href: "bread.html", current: false },
      ],
    },
    {
      id: "about",
      label: "About",
      current: false,
      children: [{ id: "team", label: "Team", href: "team.html", current: false }],
    },
  ],
};

const windows: Window[] = [];
afterEach(async () => {
  for (const happy of windows.splice(0)) await happy.happyDOM.close();
});

/**
 * A page of its own with the Header, and `menu.js` run on it unless `script` is false: each test
 * gets a fresh document, so no test's listeners reach another's. The menu and dropdowns are those
 * of small screens, where the dropdowns sit inside the menu.
 */
function page(script = true) {
  const happy = new Window();
  windows.push(happy);
  // Seen through the DOM's own types, which the script is checked against.
  const window = happy as unknown as typeof globalThis;
  const { document } = window;
  document.body.innerHTML = renderNodesToHtml(starterLayout("Bakery").header, siteLibrary, CONTEXT);
  if (script) {
    // A classic script, as webforge.js runs it, given this page's globals.
    new Function("document", "Node", "Element", "HTMLDetailsElement", BEHAVIOUR_SCRIPTS.menu ?? "")(
      document,
      window.Node,
      window.Element,
      window.HTMLDetailsElement,
    );
  }
  const find = <T extends Element>(selector: string) => {
    const element = document.querySelector<T>(selector);
    if (element === null) throw new Error(`No ${selector}`);
    return element;
  };
  const menu = find<HTMLDetailsElement>("details[data-wf-menu]");
  const [services, about] = [
    ...menu.querySelectorAll<HTMLDetailsElement>("details[data-wf-dropdown]"),
  ];
  if (services === undefined || about === undefined) throw new Error("No dropdowns");
  const summaryOf = (details: HTMLDetailsElement) => {
    const summary = details.querySelector<HTMLElement>("summary");
    if (summary === null) throw new Error("No summary");
    return summary;
  };
  /** Opens or closes `details` as its summary does, with the event the browser sends. */
  const toggle = (details: HTMLDetailsElement, open: boolean) => {
    details.open = open;
    details.dispatchEvent(new window.Event("toggle"));
  };
  const key = (name: string) =>
    document.activeElement?.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true }),
    );
  return { document, find, menu, services, about, summaryOf, toggle, key };
}

describe("the menu behaviour (R7, 2.6)", () => {
  it("is a <details> without the script: closed, its summary named Menu", () => {
    const { menu, summaryOf } = page(false);

    expect(menu.open).toBe(false);
    expect(summaryOf(menu).textContent).toBe("Menu");
  });

  it("closes the menu when one of its links is chosen", () => {
    const { menu, find, toggle } = page();
    toggle(menu, true);

    menu.querySelector<HTMLAnchorElement>('a[href="index.html"]')?.click();

    expect(menu.open).toBe(false);
    expect(find("nav").contains(menu)).toBe(true);
  });

  it("closes the menu with Escape and gives its summary the focus back", () => {
    const { menu, summaryOf, toggle, key, document } = page();
    toggle(menu, true);
    menu.querySelector<HTMLAnchorElement>('a[href="index.html"]')?.focus();

    key("Escape");

    expect(menu.open).toBe(false);
    expect(document.activeElement).toBe(summaryOf(menu));
  });

  it("keeps one dropdown open at a time, and closes it on a click outside the menu", () => {
    const { document, menu, services, about, toggle } = page();
    toggle(menu, true);

    toggle(services, true);
    toggle(about, true);
    expect(services.open).toBe(false);
    expect(about.open).toBe(true);

    document.body.click();
    expect(about.open).toBe(false);
    expect(menu.open).toBe(false);
  });

  it("closes an open dropdown first with Escape, keeping the menu open", () => {
    const { document, menu, services, summaryOf, toggle, key } = page();
    toggle(menu, true);
    toggle(services, true);
    services.querySelector<HTMLAnchorElement>("a")?.focus();

    key("Escape");

    expect(services.open).toBe(false);
    expect(document.activeElement).toBe(summaryOf(services));
    expect(menu.open).toBe(true);
    // The next Escape is the menu's.
    key("Escape");
    expect(menu.open).toBe(false);
    expect(document.activeElement).toBe(summaryOf(menu));
  });

  it("closes a dropdown when the focus moves on past its links", () => {
    const { menu, services, toggle } = page();
    toggle(menu, true);
    toggle(services, true);
    services.querySelector<HTMLAnchorElement>('a[href="bread.html"]')?.focus();

    menu.querySelector<HTMLAnchorElement>('a[href="index.html"]')?.focus();

    expect(services.open).toBe(false);
  });

  it("leaves Escape alone when the focus is somewhere else", () => {
    const { document, menu, toggle, key } = page();
    toggle(menu, true);
    const elsewhere = document.createElement("input");
    document.body.append(elsewhere);
    elsewhere.focus();

    key("Escape");

    expect(menu.open).toBe(true);
  });
});
