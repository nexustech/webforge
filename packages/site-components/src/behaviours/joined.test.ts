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
