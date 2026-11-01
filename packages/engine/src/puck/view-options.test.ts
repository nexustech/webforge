// @vitest-environment happy-dom

import { PADDED_COLUMN_CLASS } from "@webforge/site-components";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ViewOptions } from "../canvas-engine.js";
import { applyViewOptions } from "./view-options.js";

const NONE: ViewOptions = {
  outlines: false,
  spacingOnHover: false,
  elementNames: false,
  extraBottomSpace: false,
};

/** Puck's wrapper around an element, at `top` on the page, holding the element's own markup. */
function element(id: string, top: number): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-puck-component", id);
  const inner = document.createElement("h2");
  inner.style.margin = "8px 0px 12px 0px";
  inner.style.padding = "4px 6px";
  wrapper.append(inner);
  const box = new DOMRect(10, top, 300, 40);
  wrapper.getBoundingClientRect = () => box;
  inner.getBoundingClientRect = () => box;
  document.body.append(wrapper);
  return inner;
}

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
});

/** Options shown by a test, taken away after it so no observer outlives it. */
const shown: (() => void)[] = [];
const apply = (...args: Parameters<typeof applyViewOptions>) => {
  const stop = applyViewOptions(...args);
  shown.push(stop);
  return stop;
};

afterEach(() => {
  for (const stop of shown.splice(0)) stop();
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("applyViewOptions (F-ED-25)", () => {
  it("marks the document for each option that is on, and takes it all away again", () => {
    const stop = applyViewOptions(
      document,
      { ...NONE, outlines: true, extraBottomSpace: true },
      () => undefined,
    );
    const root = document.documentElement;

    expect(root.hasAttribute("data-wf-view-outlines")).toBe(true);
    expect(root.hasAttribute("data-wf-view-extra-space")).toBe(true);
    expect(root.hasAttribute("data-wf-view-names")).toBe(false);
    expect(document.head.querySelectorAll("style[data-webforge-view-css]")).toHaveLength(1);
    expect(document.querySelector(".wf-view-layer")).not.toBeNull();

    stop();
    expect(root.hasAttribute("data-wf-view-outlines")).toBe(false);
    expect(document.querySelector(".wf-view-layer")).toBeNull();
    // Applied again, the styles aren't added twice.
    apply(document, NONE, () => undefined)();
    expect(document.head.querySelectorAll("style[data-webforge-view-css]")).toHaveLength(1);
  });

  it("names each element above it, inside it at the top of the page, but not the selected one", () => {
    element("hero", 0);
    element("text", 100);
    element("faq", 200);
    const selected = document.createElement("div");
    selected.className = "wf-outline";
    selected.dataset.state = "selected";
    selected.dataset.wfId = "faq";
    document.body.append(selected);
    const names: Record<string, string> = { hero: "Hero", text: "Opening times", faq: "FAQ" };

    apply(document, { ...NONE, elementNames: true }, (id) => names[id]);

    const labels = [...document.querySelectorAll<HTMLElement>(".wf-view-name")];
    expect(labels.map((label) => [label.textContent, label.style.top])).toEqual([
      ["Hero", "0px"],
      ["Opening times", "84px"],
    ]);
    expect(labels[0]?.style.left).toBe("10px");
  });

  it("follows the page as it changes, not its hover and drag state", async () => {
    element("hero", 0);
    const observe = vi.spyOn(MutationObserver.prototype, "observe");
    apply(document, { ...NONE, elementNames: true }, () => "Section");

    // Only the attributes that lay elements out; not Puck's and dnd-kit's data- and aria- state.
    expect(observe).toHaveBeenCalledWith(
      document.body,
      expect.objectContaining({ attributeFilter: ["style", "class", "hidden"] }),
    );
    element("text", 100);
    await new Promise((resolve) => setTimeout(resolve));
    expect(document.querySelectorAll(".wf-view-name")).toHaveLength(2);
    observe.mockRestore();
  });

  it("draws the hovered element's margin and padding, and nothing once the pointer leaves", () => {
    const inner = element("hero", 100);
    const stop = apply(document, { ...NONE, spacingOnHover: true }, () => undefined);

    inner.dispatchEvent(new Event("pointermove", { bubbles: true }));
    const margin = document.querySelector<HTMLElement>(".wf-view-margin");
    const padding = document.querySelector<HTMLElement>(".wf-view-padding");
    expect(margin?.style.top).toBe("92px");
    expect(margin?.style.height).toBe("60px");
    const sides = (box: HTMLElement | null) =>
      ["Top", "Right", "Bottom", "Left"].map((side) =>
        box?.style.getPropertyValue(`border-${side.toLowerCase()}-width`),
      );
    expect(sides(margin)).toEqual(["8px", "0px", "12px", "0px"]);
    expect(sides(padding)).toEqual(["4px", "6px", "4px", "6px"]);

    // A resize moves the bands with the element.
    inner.getBoundingClientRect = () => new DOMRect(10, 200, 300, 40);
    window.dispatchEvent(new Event("resize"));
    expect(margin?.style.top).toBe("192px");

    document.documentElement.dispatchEvent(new Event("pointerleave"));
    expect(document.querySelector(".wf-view-margin")).toBeNull();
    stop();
  });

  it("draws a Medium Section's padding on its column, which holds it (#643)", () => {
    const band = element("section", 100);
    band.style.padding = "0px";
    const column = document.createElement("div");
    column.className = PADDED_COLUMN_CLASS;
    column.style.padding = "64px 16px";
    column.getBoundingClientRect = () => new DOMRect(200, 100, 896, 40);
    band.append(column);
    apply(document, { ...NONE, spacingOnHover: true }, () => undefined);

    column.dispatchEvent(new Event("pointermove", { bubbles: true }));

    const padding = document.querySelector<HTMLElement>(".wf-view-padding");
    expect(padding?.style.left).toBe("200px");
    expect(padding?.style.width).toBe("896px");
    expect(padding?.style.getPropertyValue("border-top-width")).toBe("64px");
    // The margin is still the band's.
    expect(document.querySelector<HTMLElement>(".wf-view-margin")?.style.left).toBe("10px");
  });

  it("doesn't redraw names for Puck's overlays, and looks for the selected element once a draw", async () => {
    element("hero", 0);
    element("text", 100);
    element("faq", 200);
    const overlay = document.createElement("div");
    overlay.setAttribute("data-puck-overlay", "");
    document.body.append(overlay);
    const frames = vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("requestAnimationFrame", frames);
    const query = vi.spyOn(document, "querySelector");
    apply(document, { ...NONE, elementNames: true }, () => "Section");
    const selectedLookups = () =>
      query.mock.calls.filter(([selector]) => String(selector).includes('data-state="selected"'))
        .length;
    expect(frames).toHaveBeenCalledOnce();
    expect(selectedLookups()).toBe(1);

    // The hover outline moving: Puck's overlay, not the page.
    overlay.append(document.createElement("div"));
    await new Promise((resolve) => setTimeout(resolve));
    expect(frames).toHaveBeenCalledOnce();

    element("cta", 300);
    await new Promise((resolve) => setTimeout(resolve));
    expect(frames).toHaveBeenCalledTimes(2);
    expect(selectedLookups()).toBe(2);
    query.mockRestore();
  });

  it("moves the spacing bands with the page under a still pointer, and drops them with their element", async () => {
    const inner = element("hero", 100);
    apply(document, { ...NONE, spacingOnHover: true }, () => undefined);
    inner.dispatchEvent(new Event("pointermove", { bubbles: true }));
    expect(document.querySelector<HTMLElement>(".wf-view-margin")?.style.top).toBe("92px");

    // An element added above it (a drop, an undo) moves it down.
    inner.getBoundingClientRect = () => new DOMRect(10, 160, 300, 40);
    element("added", 0);
    await new Promise((resolve) => setTimeout(resolve));
    expect(document.querySelector<HTMLElement>(".wf-view-margin")?.style.top).toBe("152px");

    // Deleted: no bands left behind.
    inner.parentElement?.remove();
    await new Promise((resolve) => setTimeout(resolve));
    expect(document.querySelector(".wf-view-margin")).toBeNull();
  });
});
