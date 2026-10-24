// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { OUTLINED_ATTRIBUTE, outlineElement } from "./chrome.js";

describe("outlineElement (R8)", () => {
  afterEach(() => document.body.replaceChildren());

  it("outlines one element at a time, by its id, and none for null", () => {
    document.body.innerHTML =
      '<div data-puck-component="a"></div><div data-puck-component="b:1"></div>';

    outlineElement(document, "a");
    outlineElement(document, "b:1");
    expect(
      [...document.querySelectorAll(`[${OUTLINED_ATTRIBUTE}]`)].map((element) =>
        element.getAttribute("data-puck-component"),
      ),
    ).toEqual(["b:1"]);

    outlineElement(document, null);
    expect(document.querySelectorAll(`[${OUTLINED_ATTRIBUTE}]`)).toHaveLength(0);
  });
});
