import { DEFAULT_THEME } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { type ProvenanceInput, provenanceOf } from "./provenance.js";

/** A Button's Corners field, set by nothing, on Desktop; `change` sets what differs. */
const input = (change: Partial<ProvenanceInput> = {}): ProvenanceInput => ({
  name: "lookCorners",
  label: "Corners",
  own: undefined,
  look: undefined,
  initial: "default",
  responsive: true,
  breakpoint: "desktop",
  type: "Button",
  item: "Button",
  section: false,
  classes: "",
  theme: { ...DEFAULT_THEME, radius: { ...DEFAULT_THEME.radius, field: "m", box: "xl" } },
  ...change,
});

describe("provenanceOf (3.12, CT-3)", () => {
  it("names the theme's token where one decides the value, and reveals it in the Theme tab", () => {
    expect(provenanceOf(input())).toEqual({
      text: "Theme's (Corners: Medium)",
      reveal: "token.radius.field",
    });
    // A section's corners are the boxes'.
    expect(provenanceOf(input({ type: "Hero", item: "Hero", section: true }))).toEqual({
      text: "Theme's (Corners: Extra large)",
      reveal: "token.radius.box",
    });
    expect(provenanceOf(input({ name: "lookShadow", label: "Shadow" })).reveal).toBe(
      "token.shadow",
    );
    expect(provenanceOf(input({ name: "lookBorder", label: "Border" })).reveal).toBe(
      "token.border",
    );
    // A text size is its text style's, from the type scale.
    expect(provenanceOf(input({ name: "lookSize", label: "Text size", textStyle: "h2" }))).toEqual({
      text: "Theme's (Text size: Heading 2)",
      reveal: "textSize.h2",
    });
  });

  it("says plain Theme's where no one token decides it", () => {
    // An element's corners other than a Button's, a colour, a text size without a style.
    expect(provenanceOf(input({ type: "Image", item: "Image" }))).toEqual({ text: "Theme's" });
    expect(provenanceOf(input({ name: "lookColor", label: "Colour", initial: "theme" }))).toEqual({
      text: "Theme's",
    });
    expect(provenanceOf(input({ name: "lookSize", label: "Text size" }))).toEqual({
      text: "Theme's",
    });
  });

  it("says the kind's look sets it, and reveals the look in Theme Studio", () => {
    expect(provenanceOf(input({ look: "full" }))).toEqual({
      text: "Theme's look for Button",
      reveal: "look:Button",
    });
    // A look per device reaches the device shown too: Mobile follows the look.
    expect(
      provenanceOf(
        input({ look: { $responsive: { desktop: "m", mobile: "full" } }, breakpoint: "mobile" }),
      ).text,
    ).toBe("Theme's look for Button");
  });

  it("says the element sets it, here or on the device shown", () => {
    expect(provenanceOf(input({ own: "full", look: "none" }))).toEqual({ text: "Set here" });
    const perDevice = { $responsive: { desktop: "full", mobile: "none" } };
    expect(provenanceOf(input({ own: perDevice, breakpoint: "mobile" }))).toEqual({
      text: "Set on Mobile",
    });
    // On Tablet it takes Desktop's own value: set here.
    expect(provenanceOf(input({ own: perDevice, breakpoint: "tablet" })).text).toBe("Set here");
  });

  it("says a colour off the theme is a custom one", () => {
    expect(
      provenanceOf(input({ name: "lookBackground", label: "Background", own: "[#1f6feb]/80" })),
    ).toEqual({ text: "Custom colour (Advanced)" });
    expect(
      provenanceOf(input({ name: "lookBackground", label: "Background", own: "primary" })).text,
    ).toBe("Set here");
  });

  it("says a class of its own sets it, where one matches the property", () => {
    expect(provenanceOf(input({ classes: "my-card md:rounded-lg" })).text).toBe("Class (Advanced)");
    expect(provenanceOf(input({ classes: "!rounded" })).text).toBe("Class (Advanced)");
    // A class for something else leaves it to the theme.
    expect(provenanceOf(input({ classes: "shadow-lg my-card" })).text).toBe(
      "Theme's (Corners: Medium)",
    );
    // Its own value comes first.
    expect(provenanceOf(input({ own: "none", classes: "rounded-lg" })).text).toBe("Set here");
  });
});
