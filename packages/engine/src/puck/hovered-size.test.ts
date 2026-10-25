// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { hoveredSize } from "./chrome.js";

afterEach(() => {
  document.body.replaceChildren();
  document.documentElement.removeAttribute("data-wf-view-spacing");
});

/** Gives `element` the box `width` × `height` on the page, as a browser would lay it out. */
function sized(element: Element, width: number, height: number): void {
  const box = { x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, width, height };
  element.getBoundingClientRect = () => ({ ...box, toJSON: () => box });
}

describe("the hover chip's size (SP-2)", () => {
  it("is the element's own, not Puck's wrapper's: a Small Image in a wide column", () => {
    document.body.innerHTML = '<div data-puck-component="photo"><img alt=""></div>';
    const wrapper = document.querySelector('[data-puck-component="photo"]');
    const image = wrapper?.firstElementChild;
    if (wrapper === null || image === null || image === undefined) throw new Error("No image");
    sized(wrapper, 1152, 256);
    sized(image, 256, 256);

    // Off while spacing on hover is off.
    expect(hoveredSize(document, "photo")).toBeUndefined();
    document.documentElement.setAttribute("data-wf-view-spacing", "");
    expect(hoveredSize(document, "photo")).toBe("256 × 256");
  });
});
