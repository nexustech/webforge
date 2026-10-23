// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { CANVAS_HOST_ATTRIBUTE, hidePuckLayout } from "./layout-styles.js";

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

describe("hidePuckLayout (#274)", () => {
  it("marks the canvas's element and hides Puck's rail and sidebars inside it, once", () => {
    const host = document.createElement("div");
    document.body.append(host);

    hidePuckLayout(host);
    hidePuckLayout(host);

    expect(host.hasAttribute(CANVAS_HOST_ATTRIBUTE)).toBe(true);
    const styles = document.head.querySelectorAll("style[data-webforge-puck-layout]");
    expect(styles).toHaveLength(1);
    const css = styles[0]?.textContent ?? "";
    for (const part of ["_PuckLayout-nav_", "_Sidebar--left_", "_Sidebar--right_"]) {
      expect(css).toContain(`[${CANVAS_HOST_ATTRIBUTE}] [class*="${part}"]`);
    }
    expect(css).toContain("--puck-pluginbar-width: 0px");
  });
});
