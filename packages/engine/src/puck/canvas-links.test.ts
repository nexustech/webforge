// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { keepLinksOnCanvas } from "./canvas-links.js";

// That it works on the canvas iframe's elements, which are another realm's (as happy-dom's windows
// aren't), is checked by e2e/app/gallery.spec.ts.
describe("keepLinksOnCanvas", () => {
  const stops: (() => void)[] = [];
  afterEach(() => {
    for (const stop of stops.splice(0)) stop();
    document.body.replaceChildren();
  });

  /** A click on `element`, and whether the browser's default was cancelled. */
  const click = (element: Element) => {
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  };

  it("follows no link clicked on the canvas, inside the link too, and still passes the click on", () => {
    document.body.innerHTML = '<a href="webforge-media://original/abc"><img alt="Shop"></a>';
    const selected = vi.fn();
    document.body.addEventListener("click", selected);
    stops.push(keepLinksOnCanvas(document));

    expect(click(document.querySelector("a") as Element)).toBe(true);
    expect(click(document.querySelector("img") as Element)).toBe(true);
    // Puck selects the element as before.
    expect(selected).toHaveBeenCalledTimes(2);
  });

  it("leaves other clicks alone, and stops when asked", () => {
    document.body.innerHTML = '<button type="button">Next</button><a href="#top">Top</a>';
    const stop = keepLinksOnCanvas(document);

    expect(click(document.querySelector("button") as Element)).toBe(false);
    stop();
    expect(click(document.querySelector("a") as Element)).toBe(false);
  });
});
