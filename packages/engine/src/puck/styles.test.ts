// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { ensureStyle } from "./styles.js";

describe("ensureStyle (R8)", () => {
  afterEach(() => {
    document.head.replaceChildren();
  });

  it("adds a style once, by its mark, and changes its text only when asked", () => {
    const first = ensureStyle(document, "data-test-style", ".a { color: red; }");
    const again = ensureStyle(document, "data-test-style");

    expect(again).toBe(first);
    expect(document.head.querySelectorAll("style[data-test-style]")).toHaveLength(1);
    expect(again.textContent).toBe(".a { color: red; }");
    ensureStyle(document, "data-test-style", ".a { color: blue; }");
    expect(first.textContent).toBe(".a { color: blue; }");
  });

  it("adds a style first in the head when asked, so later ones win", () => {
    const later = document.createElement("style");
    document.head.append(later);

    const style = ensureStyle(document, "data-site-style", "body {}", "start");

    expect(document.head.firstElementChild).toBe(style);
  });
});
