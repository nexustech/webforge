import { Window } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";
import { BEHAVIOUR_SCRIPTS } from "../behaviours.js";
import { siteLibrary, starterLayout } from "../catalogue/index.js";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";

// The "header-hide" behaviour (HH-7) on a sticky Header as the export renders it.

const windows: Window[] = [];
afterEach(async () => {
  for (const happy of windows.splice(0)) await happy.happyDOM.close();
});

/** A page of its own with a sticky Header in `scrollStyle`, and `header-hide.js` run on it. */
function page(scrollStyle = "hide") {
  const happy = new Window({ width: 1024, height: 768 });
  windows.push(happy);
  const window = happy as unknown as typeof globalThis;
  const { document } = window;
  const [header] = starterLayout("Bakery").header;
  if (header === undefined) throw new Error("No Header");
  document.body.innerHTML = renderNodesToHtml(
    [{ ...header, props: { ...header.props, sticky: true, scrollStyle } }],
    siteLibrary,
    EDITOR_RENDER_CONTEXT,
  );
  // A page that scrolls, which happy-dom doesn't lay out: 5000 px tall.
  Object.defineProperty(document.documentElement, "scrollHeight", {
    value: 5000,
    configurable: true,
  });
  new Function("document", "window", "HTMLElement", BEHAVIOUR_SCRIPTS["header-hide"] ?? "")(
    document,
    window,
    window.HTMLElement,
  );
  const element = document.querySelector<HTMLElement>("[data-wf-sticky]");
  if (element === null) throw new Error("No sticky header");
  const scrollTo = (y: number) => {
    Object.defineProperty(window, "scrollY", { value: y, configurable: true });
    window.dispatchEvent(new window.Event("scroll"));
  };
  return { document, element, scrollTo };
}

describe("a Header that hides on the way down (HH-7)", () => {
  it("leaves the other styles' headers in view", () => {
    const { element, scrollTo } = page("shadow");

    expect(element.getAttribute("data-wf-sticky")).toBe("");
    scrollTo(400);
    expect(element.hasAttribute("data-hidden")).toBe(false);
  });

  it("hides on the way down past 80 px, and shows on the way up and at the top", () => {
    const { element, scrollTo } = page("hide");

    expect(element.getAttribute("data-wf-sticky")).toBe("hide");
    scrollTo(60);
    expect(element.hasAttribute("data-hidden")).toBe(false);
    scrollTo(300);
    expect(element.hasAttribute("data-hidden")).toBe(true);
    scrollTo(600);
    expect(element.hasAttribute("data-hidden")).toBe(true);
    scrollTo(500);
    expect(element.hasAttribute("data-hidden")).toBe(false);
    scrollTo(900);
    expect(element.hasAttribute("data-hidden")).toBe(true);
    scrollTo(40);
    expect(element.hasAttribute("data-hidden")).toBe(false);
  });

  it("doesn't flick at a jitter of a few pixels", () => {
    const { element, scrollTo } = page("hide");

    scrollTo(300);
    expect(element.hasAttribute("data-hidden")).toBe(true);
    scrollTo(297);
    expect(element.hasAttribute("data-hidden")).toBe(true);
    scrollTo(290);
    expect(element.hasAttribute("data-hidden")).toBe(false);
    scrollTo(293);
    expect(element.hasAttribute("data-hidden")).toBe(false);
  });

  it("stays out of view as a phone's scroll bounces back from the bottom of the page", () => {
    const { document, element, scrollTo } = page("hide");
    Object.defineProperty(document.documentElement, "scrollHeight", {
      value: 2000,
      configurable: true,
    });
    const bottom = 2000 - 768;

    scrollTo(bottom);
    expect(element.hasAttribute("data-hidden")).toBe(true);
    scrollTo(bottom + 40);
    scrollTo(bottom);
    expect(element.hasAttribute("data-hidden")).toBe(true);
  });

  it("stays in view while its phone menu is open", () => {
    const { element, scrollTo } = page("hide");
    const menu = element.querySelector("details");
    if (menu === null) throw new Error("No phone menu");

    menu.setAttribute("open", "");
    scrollTo(300);
    expect(element.hasAttribute("data-hidden")).toBe(false);
    menu.removeAttribute("open");
    scrollTo(600);
    expect(element.hasAttribute("data-hidden")).toBe(true);
  });

  it("comes back when the keyboard's focus moves into it", () => {
    const { element, scrollTo } = page("hide");
    const link = element.querySelector("a");
    if (link === null) throw new Error("No link");

    scrollTo(300);
    expect(element.hasAttribute("data-hidden")).toBe(true);
    link.focus();
    expect(element.hasAttribute("data-hidden")).toBe(false);
  });
});
