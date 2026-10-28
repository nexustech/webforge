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
  corners: "field",
  classes: "",
  theme: { ...DEFAULT_THEME, radius: { ...DEFAULT_THEME.radius, field: "m", box: "xl" } },
  ...change,
});

const textOf = (change: Partial<ProvenanceInput>) => provenanceOf(input(change))?.text;

describe("provenanceOf (3.12, CT-3)", () => {
  it("names the theme's token where one decides the value, and reveals it in the Theme tab", () => {
    expect(provenanceOf(input())).toEqual({
      text: "Theme's (Corners: Medium)",
      reveal: "token.radius.field",
    });
    // A section's corners are the boxes', by its kind's own flag.
    expect(provenanceOf(input({ type: "Hero", item: "Hero", corners: "box" }))).toEqual({
      text: "Theme's (Corners: Extra large)",
      reveal: "token.radius.box",
    });
    expect(provenanceOf(input({ name: "lookShadow", label: "Shadow" }))?.reveal).toBe(
      "token.shadow",
    );
    expect(provenanceOf(input({ name: "lookBorder", label: "Border" }))?.reveal).toBe(
      "token.border",
    );
    // A text size is its text style's, from the type scale.
    expect(provenanceOf(input({ name: "lookSize", label: "Text size", textStyle: "h2" }))).toEqual({
      text: "Theme's (Text size: Heading 2)",
      reveal: "textSize.h2",
    });
  });

  it("says nothing where it would only repeat the control's Theme's (#567)", () => {
    // An element whose corners no one token decides, a colour, a text size without a style.
    expect(
      provenanceOf(input({ type: "Image", item: "Image", corners: undefined })),
    ).toBeUndefined();
    expect(
      provenanceOf(input({ name: "lookColor", label: "Colour", initial: "theme" })),
    ).toBeUndefined();
    expect(provenanceOf(input({ name: "lookSize", label: "Text size" }))).toBeUndefined();
  });

  it("says nothing for a field whose default isn't the theme's, as an overlay's (#567)", () => {
    expect(
      provenanceOf(input({ name: "overlay", label: "Overlay", initial: "60", responsive: false })),
    ).toBeUndefined();
    // Its own value still says so.
    expect(textOf({ name: "overlay", label: "Overlay", initial: "60", own: "20" })).toBe(
      "Set here",
    );
  });

  it("says the kind's look sets it, and reveals the look in Theme Studio", () => {
    expect(provenanceOf(input({ look: "full" }))).toEqual({
      text: "Theme's look for Button",
      reveal: "look:Button",
    });
    // A look per device reaches the device shown too: Mobile follows the look.
    expect(
      textOf({ look: { $responsive: { desktop: "m", mobile: "full" } }, breakpoint: "mobile" }),
    ).toBe("Theme's look for Button");
  });

  it("says the element sets it, here or on the device shown", () => {
    expect(textOf({ own: "full", look: "none" })).toBe("Set here");
    const perDevice = { $responsive: { desktop: "full", mobile: "none" } };
    expect(textOf({ own: perDevice, breakpoint: "mobile" })).toBe("Set on Mobile");
    // On Tablet it takes Desktop's own value: set here.
    expect(textOf({ own: perDevice, breakpoint: "tablet" })).toBe("Set here");
  });

  it("names the token for the theme's own value chosen here, with its reveal (#567)", () => {
    expect(provenanceOf(input({ own: "default", look: "full" }))).toEqual({
      text: "Theme's (Corners: Medium), chosen here",
      reveal: "token.radius.field",
    });
    // Where no one token decides it, it is set here.
    expect(textOf({ name: "lookColor", label: "Colour", own: "theme" })).toBe("Set here");
  });

  it("says a colour off the theme is a custom one", () => {
    expect(textOf({ name: "lookBackground", label: "Background", own: "[#1f6feb]/80" })).toBe(
      "Custom colour (Advanced)",
    );
    expect(textOf({ name: "lookBackground", label: "Background", own: "primary" })).toBe(
      "Set here",
    );
  });

  it("says a class of its own sets it, where one matches that property alone (#567)", () => {
    expect(textOf({ classes: "my-card md:rounded-lg" })).toBe("Class (Advanced)");
    expect(textOf({ classes: "!rounded" })).toBe("Class (Advanced)");
    // A class for something else leaves it to the theme.
    expect(textOf({ classes: "shadow-lg my-card" })).toBe("Theme's (Corners: Medium)");
    // Its own value comes first.
    expect(textOf({ own: "none", classes: "rounded-lg" })).toBe("Set here");

    // Text alignment, size and colour, each its own.
    const text = (name: string, classes: string) =>
      textOf({ name, label: name, classes, textStyle: "h2" });
    expect(text("lookAlign", "text-center")).toBe("Class (Advanced)");
    expect(text("lookColor", "text-center")).toBeUndefined();
    expect(text("lookSize", "md:text-2xl")).toBe("Class (Advanced)");
    expect(text("lookColor", "text-2xl")).toBeUndefined();
    expect(text("lookColor", "text-primary")).toBe("Class (Advanced)");
    expect(text("lookSize", "text-primary")).toBe("Theme's (lookSize: Heading 2)");
    // A border's width, or its colour.
    expect(text("lookBorder", "border-2")).toBe("Class (Advanced)");
    expect(text("lookBorderColor", "border-2")).toBeUndefined();
    expect(text("lookBorderColor", "border-accent")).toBe("Class (Advanced)");
    // A font's weight, not its family.
    expect(text("lookWeight", "font-semibold")).toBe("Class (Advanced)");
    expect(text("lookWeight", "font-serif")).toBeUndefined();
  });
});
