import { Window } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";
import { BEHAVIOUR_SCRIPTS } from "../behaviours.js";
import { siteLibrary, starterLayout } from "../catalogue/index.js";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";

// The "sticky" behaviour (F-DS-6, 2.6) on a sticky Header as the export renders it.

const windows: Window[] = [];
afterEach(async () => {
  for (const happy of windows.splice(0)) await happy.happyDOM.close();
});

/** A page of its own with a sticky Header, and `sticky.js` run on it. */
function page() {
  const happy = new Window({ width: 1024, height: 768 });
  windows.push(happy);
  const window = happy as unknown as typeof globalThis;
  const { document } = window;
  const [header] = starterLayout("Bakery").header;
  if (header === undefined) throw new Error("No Header");
  document.body.innerHTML = renderNodesToHtml(
    [{ ...header, props: { ...header.props, sticky: true, scrollStyle: "shadow" } }],
    siteLibrary,
    EDITOR_RENDER_CONTEXT,
  );
  new Function(
    "document",
    "window",
    "HTMLElement",
    "ResizeObserver",
    BEHAVIOUR_SCRIPTS.sticky ?? "",
  )(document, window, window.HTMLElement, undefined);
  const element = document.querySelector<HTMLElement>("[data-wf-sticky]");
  if (element === null) throw new Error("No sticky header");
  const scrollTo = (y: number) => {
    Object.defineProperty(window, "scrollY", { value: y, configurable: true });
    window.dispatchEvent(new window.Event("scroll"));
  };
  return { document, element, scrollTo };
}

describe("the sticky behaviour (2.6)", () => {
  it("marks the header once the page has scrolled past 80 px, and again not once back", () => {
    const { element, scrollTo } = page();

    expect(element.hasAttribute("data-scrolled")).toBe(false);
    scrollTo(80);
    expect(element.hasAttribute("data-scrolled")).toBe(false);
    scrollTo(81);
    expect(element.hasAttribute("data-scrolled")).toBe(true);
    scrollTo(0);
    expect(element.hasAttribute("data-scrolled")).toBe(false);
  });

  it("gives the page a scroll padding as tall as the header, so anchors aren't hidden", () => {
    const { document } = page();

    expect(document.documentElement.style.scrollPaddingTop).toMatch(/^\d+px$/);
  });
});
