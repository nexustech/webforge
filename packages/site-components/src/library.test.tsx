import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  EDITOR_RENDER_CONTEXT,
  optionValue,
  responsiveClasses,
  slotComponent,
  stringValue,
  textValue,
  withAdvanced,
} from "./library.js";

describe("library helpers", () => {
  it("textValue passes renderable text and drops anything else", () => {
    expect(textValue("Hi")).toBe("Hi");
    expect(textValue(3)).toBe(3);
    expect(renderToStaticMarkup(textValue(<b>bold</b>))).toBe("<b>bold</b>");
    expect(textValue({ html: "x" })).toBeNull();
    expect(textValue(undefined)).toBeNull();
  });

  it("stringValue keeps strings only", () => {
    expect(stringValue("about")).toBe("about");
    expect(stringValue(1)).toBe("");
    expect(stringValue(undefined)).toBe("");
  });

  it("optionValue falls back to the first option", () => {
    expect(optionValue("b", ["a", "b"])).toBe("b");
    expect(optionValue("c", ["a", "b"])).toBe("a");
    expect(optionValue(1, ["a"])).toBe("a");
  });

  it("slotComponent returns the slot or an empty one", () => {
    const Slot = () => <i>slot</i>;
    const props = { id: "x", values: {}, slots: { content: Slot }, context: EDITOR_RENDER_CONTEXT };
    const Missing = slotComponent(props, "other");

    expect(slotComponent(props, "content")).toBe(Slot);
    expect(renderToStaticMarkup(<Missing />)).toBe("");
  });

  it("the editor context has no navigation, dead links and no images", () => {
    expect(EDITOR_RENDER_CONTEXT.navigation).toEqual([]);
    expect(EDITOR_RENDER_CONTEXT.link("about")).toBe("#");
    expect(EDITOR_RENDER_CONTEXT.image("hero")).toBeNull();
  });

  it("responsiveClasses gives a plain value's classes alone", () => {
    expect(responsiveClasses<string>("small", (value) => `py-${value}`)).toBe("py-small");
  });

  it("responsiveClasses builds mobile-first classes, prefixed only where a device differs", () => {
    // Mobile falls back to Tablet, then Desktop.
    const classes = (value: string | undefined) => (value === "large" ? "py-24" : "py-8");

    expect(
      responsiveClasses<string>({ $responsive: { desktop: "large", mobile: "small" } }, classes),
    ).toBe("py-8 md:py-24");
    expect(
      responsiveClasses<string>({ $responsive: { desktop: "small", tablet: "large" } }, classes),
    ).toBe("py-24 lg:py-8");
  });
});

describe("withAdvanced", () => {
  const html = (advanced: unknown) =>
    renderToStaticMarkup(<>{withAdvanced(<h2 className="site-heading">Hi</h2>, advanced)}</>);

  it("adds the classes after the component's own, the attributes and the anchor as id", () => {
    expect(
      html({
        className: "shadow-lg",
        anchorId: "opening-times",
        attributes: { "data-track": "hero", tabindex: "0", role: "note" },
      }),
    ).toBe(
      '<h2 class="site-heading shadow-lg" data-track="hero" tabindex="0" role="note" id="opening-times">Hi</h2>',
    );
  });

  it("leaves the output alone without options, with invalid ones, or without an element root", () => {
    expect(html(undefined)).toBe('<h2 class="site-heading">Hi</h2>');
    // Checked again here: an event handler never reaches a page, whatever the document holds.
    expect(html({ attributes: { onclick: "alert(1)" } })).toBe('<h2 class="site-heading">Hi</h2>');
    expect(html({ anchorId: "Not valid" })).toBe('<h2 class="site-heading">Hi</h2>');
    expect(renderToStaticMarkup(<>{withAdvanced("text", { className: "x" })}</>)).toBe("text");
  });
});
