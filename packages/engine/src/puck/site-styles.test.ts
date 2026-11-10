// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { applyCustomCss, applySiteStyles } from "./site-styles.js";

describe("applySiteStyles", () => {
  it("keeps one site <style> first in the head and updates it in place", () => {
    const doc = document.implementation.createHTMLDocument();
    const puck = doc.createElement("style");
    puck.textContent = ".puck{}";
    doc.head.append(puck);

    applySiteStyles(doc, { css: ".a{}", bodyClass: "" });
    const element = doc.head.firstElementChild;
    applySiteStyles(doc, { css: ".b{}", bodyClass: "" });

    expect(doc.head.querySelectorAll("style[data-webforge-site-css]")).toHaveLength(1);
    expect(doc.head.firstElementChild).toBe(element);
    expect(element?.textContent).toBe(".b{}");
    expect(puck.textContent).toBe(".puck{}");
  });

  it("replaces the body classes it added and leaves the others", () => {
    const doc = document.implementation.createHTMLDocument();
    doc.body.classList.add("puck-body");

    applySiteStyles(doc, { css: "", bodyClass: "bg-base-100  font-sans" });
    applySiteStyles(doc, { css: "", bodyClass: "bg-base-200" });

    expect([...doc.body.classList]).toEqual(["puck-body", "bg-base-200"]);
  });

  it("marks the window's timeline the first time a canvas gets the site's CSS (#891)", () => {
    const doc = document.implementation.createHTMLDocument();

    applySiteStyles(doc, { css: ".a{}", bodyClass: "" });
    applySiteStyles(document.implementation.createHTMLDocument(), { css: ".b{}", bodyClass: "" });

    // Once only, whichever test applied styles first.
    expect(performance.getEntriesByName("webforge:canvas-styled")).toHaveLength(1);
  });
});

describe("applyCustomCss (6.8)", () => {
  const order = (doc: Document) =>
    [...doc.head.children].map((element) =>
      element.hasAttribute("data-webforge-site-css")
        ? "site"
        : element.hasAttribute("data-webforge-custom-css")
          ? "custom"
          : "puck",
    );

  it("keeps the site's own CSS right after its compiled CSS, whichever comes first", () => {
    const doc = document.implementation.createHTMLDocument();
    const puck = doc.createElement("style");
    doc.head.append(puck);

    applyCustomCss(doc, ".mine{}");
    expect(order(doc)).toEqual(["custom", "puck"]);
    applySiteStyles(doc, { css: ".a{}", bodyClass: "" });
    expect(order(doc)).toEqual(["site", "custom", "puck"]);
    applyCustomCss(doc, ".mine{color:red}");

    expect(order(doc)).toEqual(["site", "custom", "puck"]);
    expect(doc.head.querySelector("style[data-webforge-custom-css]")?.textContent).toBe(
      ".mine{color:red}",
    );
  });
});
