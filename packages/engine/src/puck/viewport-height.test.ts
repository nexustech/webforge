// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type { CanvasSize } from "../canvas-engine.js";
import { followViewportHeight } from "./viewport-height.js";

// The canvas gives its page the window's height a visitor would see (HH-4): its frame grows with
// the page, so `vh` there would keep growing.

const height = () => document.documentElement.style.getPropertyValue("--wf-viewport-h");

describe("followViewportHeight (HH-4)", () => {
  it("sets the editor window's height at once, then each height the canvas reports, until stopped", () => {
    let report: ((size: CanvasSize) => void) | undefined;
    let stopped = false;
    const sizes = (listener: (size: CanvasSize) => void) => {
      report = listener;
      return () => {
        stopped = true;
      };
    };

    const stop = followViewportHeight(document, sizes, 812.4);
    expect(height()).toBe("812px");
    // The part of the page in view, in its own pixels: at any zoom.
    report?.({ width: 390, height: 1240, zoom: 0.5 });
    expect(height()).toBe("1240px");
    // A canvas not measured yet reports nothing to go by.
    report?.({ width: 390, height: 0, zoom: 1 });
    expect(height()).toBe("1240px");

    stop();
    expect(stopped).toBe(true);
    expect(height()).toBe("");
  });

  it("waits for the canvas when there's no window to go by", () => {
    const stop = followViewportHeight(document, () => () => {});
    expect(height()).toBe("");
    stop();
  });
});
