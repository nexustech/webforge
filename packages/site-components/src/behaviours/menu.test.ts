import { Window } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";
import { BEHAVIOUR_SCRIPTS } from "../behaviours.js";
import { siteLibrary, starterLayout } from "../catalogue/index.js";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";
import type { RenderContext } from "../schema.js";

// The "menu" behaviour (F-ED-17, ADR 0005) on the Header as the export renders it: the menu on
// small screens, and the dropdowns in it.

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
 * gets a fresh document, so no test's listeners reach another's.
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
    new Function("document", "Node", "Element", "HTMLElement", BEHAVIOUR_SCRIPTS.menu ?? "")(
      document,
      window.Node,
      window.Element,
      window.HTMLElement,
    );
  }
  const find = <T extends Element>(selector: string) => {
    const element = document.querySelector<T>(selector);
    if (element === null) throw new Error(`No ${selector}`);
    return element;
  };
  const menuToggle = find<HTMLButtonElement>("[data-wf-menu-toggle]");
  const [services, about] = [
    ...document.querySelectorAll<HTMLButtonElement>("[data-wf-submenu-toggle]"),
  ];
  if (services === undefined || about === undefined) throw new Error("No dropdowns");
  const listOf = (toggle: Element) => find(`#${toggle.getAttribute("aria-controls")}`);
  const key = (name: string) =>
    document.activeElement?.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true }),
    );
  return { document, find, menuToggle, services, about, listOf, key };
}

const expanded = (toggle: Element) => toggle.getAttribute("aria-expanded");

describe("the menu behaviour (R7)", () => {
  it("leaves the menu to its CSS fallback without the script", () => {
    const { find, menuToggle } = page(false);

    expect(find("nav").hasAttribute("data-wf-ready")).toBe(false);
    expect(expanded(menuToggle)).toBe("false");
  });

  it("opens and closes the menu with its button, and closes it when a link is chosen", () => {
    const { find, menuToggle, listOf } = page();
    const menu = listOf(menuToggle);

    expect(find("nav").hasAttribute("data-wf-ready")).toBe(true);
    menuToggle.click();
    expect(expanded(menuToggle)).toBe("true");
    expect(menu.hasAttribute("data-open")).toBe(true);
    menuToggle.click();
    expect(expanded(menuToggle)).toBe("false");
    expect(menu.hasAttribute("data-open")).toBe(false);

    menuToggle.click();
    find<HTMLAnchorElement>('a[href="index.html"]').click();
    expect(expanded(menuToggle)).toBe("false");
  });

  it("closes the menu with Escape and gives its button the focus back", () => {
    const { document, menuToggle, key } = page();
    menuToggle.click();
    document.querySelector<HTMLAnchorElement>('a[href="index.html"]')?.focus();

    key("Escape");

    expect(expanded(menuToggle)).toBe("false");
    expect(document.activeElement).toBe(menuToggle);
  });

  it("opens one dropdown at a time, and closes it on a click outside it", () => {
    const { document, services, about, listOf } = page();

    services.click();
    expect(expanded(services)).toBe("true");
    expect(listOf(services).hasAttribute("data-open")).toBe(true);
    about.click();
    expect(expanded(services)).toBe("false");
    expect(expanded(about)).toBe("true");

    document.body.click();
    expect(expanded(about)).toBe("false");
  });

  it("closes an open dropdown first with Escape, keeping the menu open", () => {
    const { document, menuToggle, services, listOf, key } = page();
    menuToggle.click();
    services.click();
    listOf(services).querySelector<HTMLAnchorElement>("a")?.focus();

    key("Escape");

    expect(expanded(services)).toBe("false");
    expect(document.activeElement).toBe(services);
    expect(expanded(menuToggle)).toBe("true");
    // The next Escape is the menu's.
    key("Escape");
    expect(expanded(menuToggle)).toBe("false");
  });

  it("closes a dropdown when the focus moves on past its links", () => {
    const { find, services, listOf } = page();
    services.click();
    const [, last] = [...listOf(services).querySelectorAll<HTMLAnchorElement>("a")];
    last?.focus();

    find<HTMLAnchorElement>('a[href="index.html"]').focus();

    expect(expanded(services)).toBe("false");
  });
});
