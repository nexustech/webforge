// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { firstHeadingOnPage, inWindow } from "./anchors.js";

// Where the tour's and the tips' cards point (OB-2, OB-4, #991): a box in the editor's window, for
// something in the window or on the page in the canvas, whose frame is zoomed and scrolled.

afterEach(() => {
  document.body.innerHTML = "";
});

/** Gives `element` the box `box` on screen. */
function place(
  element: Element,
  box: { left: number; top: number; width: number; height: number },
) {
  element.getBoundingClientRect = () =>
    ({
      ...box,
      x: box.left,
      y: box.top,
      right: box.left + box.width,
      bottom: box.top + box.height,
    }) as DOMRect;
}

/**
 * The editor's canvas: a frame at (100, 50), `width` by `height` on screen and `offsetWidth` wide
 * in its own pixels (so zoomed by their ratio), holding a page with a heading at `heading`.
 */
function canvas(
  heading: { left: number; top: number; width: number; height: number } | null,
  { width = 800, height = 600, offsetWidth = 800 } = {},
) {
  const editor = document.createElement("div");
  editor.className = "editor__canvas";
  const frame = document.createElement("iframe");
  editor.append(frame);
  document.body.append(editor);
  place(frame, { left: 100, top: 50, width, height });
  Object.defineProperty(frame, "offsetWidth", { value: offsetWidth });
  // happy-dom doesn't load a frame's page: the frame is given one of its own.
  const page = document.implementation.createHTMLDocument("Page");
  Object.defineProperty(frame, "contentDocument", { value: page });
  if (heading !== null) {
    const h1 = page.createElement("h1");
    page.body.append(h1);
    place(h1, heading);
  }
}

describe("where the cards point (OB-2, OB-4)", () => {
  it("finds the first heading on the page, moved by the frame's place", () => {
    canvas({ left: 20, top: 30, width: 200, height: 40 });

    expect(firstHeadingOnPage(document)).toEqual({ left: 120, top: 80, width: 200, height: 40 });
  });

  it("scales it by the canvas's zoom", () => {
    canvas({ left: 20, top: 30, width: 200, height: 40 }, { width: 400, offsetWidth: 800 });

    expect(firstHeadingOnPage(document)).toEqual({ left: 110, top: 65, width: 100, height: 20 });
  });

  it("finds nothing while it's scrolled out of the canvas, not drawn, or not there", () => {
    canvas({ left: 20, top: 900, width: 200, height: 40 });
    expect(firstHeadingOnPage(document)).toBeNull();

    document.body.innerHTML = "";
    canvas({ left: 20, top: 30, width: 0, height: 0 });
    expect(firstHeadingOnPage(document)).toBeNull();

    document.body.innerHTML = "";
    canvas(null);
    expect(firstHeadingOnPage(document)).toBeNull();
    document.body.innerHTML = "";
    expect(firstHeadingOnPage(document)).toBeNull();
  });

  it("finds something in the window as it is, while it's drawn", () => {
    const button = document.createElement("button");
    button.className = "site-check";
    document.body.append(button);
    place(button, { left: 5, top: 6, width: 30, height: 20 });

    expect(inWindow(document, ".site-check")).toMatchObject({ left: 5, top: 6, width: 30 });
    place(button, { left: 5, top: 6, width: 0, height: 0 });
    expect(inWindow(document, ".site-check")).toBeNull();
    expect(inWindow(document, ".missing")).toBeNull();
  });
});
