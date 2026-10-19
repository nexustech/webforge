import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { optionValue, slotComponent, textValue } from "./library.js";

describe("library helpers", () => {
  it("textValue passes renderable text and drops anything else", () => {
    expect(textValue("Hi")).toBe("Hi");
    expect(textValue(3)).toBe(3);
    expect(renderToStaticMarkup(textValue(<b>bold</b>))).toBe("<b>bold</b>");
    expect(textValue({ html: "x" })).toBeNull();
    expect(textValue(undefined)).toBeNull();
  });

  it("optionValue falls back to the first option", () => {
    expect(optionValue("b", ["a", "b"])).toBe("b");
    expect(optionValue("c", ["a", "b"])).toBe("a");
    expect(optionValue(1, ["a"])).toBe("a");
  });

  it("slotComponent returns the slot or an empty one", () => {
    const Slot = () => <i>slot</i>;
    const props = { id: "x", values: {}, slots: { content: Slot } };
    const Missing = slotComponent(props, "other");

    expect(slotComponent(props, "content")).toBe(Slot);
    expect(renderToStaticMarkup(<Missing />)).toBe("");
  });
});
