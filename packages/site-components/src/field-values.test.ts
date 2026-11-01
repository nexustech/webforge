import { describe, expect, it } from "vitest";
import { siteLibrary } from "./catalogue/index.js";
import { acceptsFieldValue, type FieldValueShape } from "./field-values.js";

const field = (type: string, name: string): FieldValueShape => {
  const found = siteLibrary.components[type]?.fields[name];
  if (found === undefined) throw new Error(`${type} has no field ${name}`);
  return found;
};

const one = { responsive: false } as const;

describe("acceptsFieldValue (#667)", () => {
  it("takes a slider's own steps only: a Section's gap none isn't one of Columns'", () => {
    expect(acceptsFieldValue(field("Section", "gap"), "none", one)).toBe(true);
    expect(acceptsFieldValue(field("Columns", "gap"), "none", one)).toBe(false);
    expect(acceptsFieldValue(field("Columns", "gap"), "large", one)).toBe(true);
  });

  it("takes one device's value, or with responsive the value per device too", () => {
    const gap = field("Columns", "gap");
    const perDevice = { $responsive: { desktop: "large", mobile: "small" } };
    expect(acceptsFieldValue(gap, perDevice, one)).toBe(false);
    expect(acceptsFieldValue(gap, perDevice, { responsive: true })).toBe(true);
    expect(acceptsFieldValue(gap, { $responsive: { desktop: "none" } }, { responsive: true })).toBe(
      false,
    );
  });

  it("takes a select's options, a toggle's booleans and a colour's options or theme colours", () => {
    expect(acceptsFieldValue({ kind: "select", options: [{ value: "a" }] }, "a", one)).toBe(true);
    expect(acceptsFieldValue({ kind: "select", options: [{ value: "a" }] }, "b", one)).toBe(false);
    expect(acceptsFieldValue({ kind: "toggle" }, true, one)).toBe(true);
    expect(acceptsFieldValue({ kind: "toggle" }, "true", one)).toBe(false);
    const color = { kind: "color", options: [{ value: "default" }] } as const;
    expect(acceptsFieldValue(color, "default", one)).toBe(true);
    expect(acceptsFieldValue(color, "primary", one)).toBe(true);
    expect(acceptsFieldValue(color, "#ff0000", one)).toBe(false);
  });

  it("takes none for an image or an icon, to take it away, and for nothing else", () => {
    expect(acceptsFieldValue({ kind: "media" }, undefined, one)).toBe(true);
    expect(acceptsFieldValue({ kind: "icon" }, undefined, one)).toBe(true);
    expect(acceptsFieldValue({ kind: "text" }, undefined, one)).toBe(false);
    expect(acceptsFieldValue({ kind: "box" }, undefined, one)).toBe(false);
  });

  it("takes Custom Code as text, which only the person writes in the editor", () => {
    expect(acceptsFieldValue({ kind: "code" }, "<b>Hi</b>", one)).toBe(true);
    expect(acceptsFieldValue({ kind: "code" }, 1, one)).toBe(false);
  });

  it("takes a box of spacing tokens per side, not any object", () => {
    expect(acceptsFieldValue({ kind: "box" }, { top: "m", left: "none" }, one)).toBe(true);
    expect(acceptsFieldValue({ kind: "box" }, { top: "huge" }, one)).toBe(false);
    expect(acceptsFieldValue({ kind: "box" }, "m", one)).toBe(false);
  });
});
