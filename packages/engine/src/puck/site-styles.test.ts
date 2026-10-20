// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { applySiteStyles } from "./site-styles.js";

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
});
