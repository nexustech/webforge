import { describe, expect, it } from "vitest";
import {
  ADVANCED_FIELDS,
  advancedFieldLabel,
  advancedFields,
  isAdvancedField,
  withAdvancedChange,
} from "./advanced-fields.js";

const fieldNamed = (name: string, advanced = {}) => {
  const field = advancedFields(advanced).find((candidate) => candidate.name === name);
  if (field === undefined) throw new Error(`no ${name}`);
  return field;
};

describe("advancedFields", () => {
  it("shows a node's classes, anchor and attributes on the Advanced tab", () => {
    const fields = advancedFields({
      className: "shadow-lg",
      anchorId: "opening-times",
      attributes: { "data-track": "hero", role: "note" },
    });

    expect(fields.map((field) => [field.name, field.group, field.value])).toEqual([
      [ADVANCED_FIELDS.className, "advanced", "shadow-lg"],
      [ADVANCED_FIELDS.anchorId, "advanced", "opening-times"],
      [
        ADVANCED_FIELDS.attributes,
        "advanced",
        [
          { key: "0", values: { name: "data-track", value: "hero" } },
          { key: "1", values: { name: "role", value: "note" } },
        ],
      ],
    ]);
    expect(advancedFields(undefined).map((field) => field.value)).toEqual(["", "", []]);
  });

  it("accepts only what a site file accepts", () => {
    const classes = fieldNamed(ADVANCED_FIELDS.className).validate;
    const anchor = fieldNamed(ADVANCED_FIELDS.anchorId).validate;
    const [name, value] = fieldNamed(ADVANCED_FIELDS.attributes, {
      attributes: { "data-a": "1" },
    }).itemFields ?? [{}, {}];

    expect(classes?.("  shadow-lg   md:p-4 ")).toBeUndefined();
    expect(classes?.('bad"class')).toBe("Use class names separated by spaces");
    expect(anchor?.("")).toBeUndefined();
    expect(anchor?.("opening-times")).toBeUndefined();
    expect(anchor?.("Opening times")).toMatch(/lowercase letters/);
    expect(anchor?.("my-")).toMatch(/lowercase letters/);
    expect(name?.validate?.("data-track")).toBeUndefined();
    expect(name?.validate?.("onclick")).toMatch(/data-…/);
    expect(name?.validate?.("style")).toMatch(/data-…/);
    expect(name?.validate?.("data-a")).toBe("This element already has this attribute");
    expect(value?.validate?.("x".repeat(1000))).toBeUndefined();
    expect(value?.validate?.("x".repeat(1001))).toBe("Use at most 1000 characters");
  });

  it("names its fields for undo labels", () => {
    expect(isAdvancedField(ADVANCED_FIELDS.anchorId)).toBe(true);
    expect(isAdvancedField("text")).toBe(false);
    expect(advancedFieldLabel(ADVANCED_FIELDS.className)).toBe("CSS classes");
    expect(advancedFieldLabel(ADVANCED_FIELDS.anchorId)).toBe("anchor ID");
  });
});

describe("withAdvancedChange", () => {
  it("sets classes with single spaces and the anchor, dropping empty options", () => {
    const withClasses = withAdvancedChange(undefined, ADVANCED_FIELDS.className, " a   b ");
    expect(withClasses).toEqual({ className: "a b" });

    const withAnchor = withAdvancedChange(withClasses, ADVANCED_FIELDS.anchorId, "prices");
    expect(withAnchor).toEqual({ className: "a b", anchorId: "prices" });
    expect(withAdvancedChange(withAnchor, ADVANCED_FIELDS.className, "")).toEqual({
      anchorId: "prices",
    });
    expect(
      withAdvancedChange({ anchorId: "prices" }, ADVANCED_FIELDS.anchorId, ""),
    ).toBeUndefined();
  });

  it("adds, renames, moves and removes attributes", () => {
    let advanced = withAdvancedChange(undefined, ADVANCED_FIELDS.attributes, { type: "add" });
    expect(advanced).toEqual({ attributes: { "data-attribute": "" } });
    advanced = withAdvancedChange(advanced, ADVANCED_FIELDS.attributes, { type: "add" });
    expect(Object.keys(advanced?.attributes ?? {})).toEqual(["data-attribute", "data-attribute-2"]);
    advanced = withAdvancedChange(advanced, ADVANCED_FIELDS.attributes, {
      type: "edit",
      key: "1",
      name: "name",
      value: "role",
    });
    advanced = withAdvancedChange(advanced, ADVANCED_FIELDS.attributes, {
      type: "edit",
      key: "1",
      name: "value",
      value: "note",
    });
    advanced = withAdvancedChange(advanced, ADVANCED_FIELDS.attributes, {
      type: "move",
      key: "1",
      to: 0,
    });
    expect(advanced).toEqual({ attributes: { role: "note", "data-attribute": "" } });

    advanced = withAdvancedChange(advanced, ADVANCED_FIELDS.attributes, {
      type: "remove",
      key: "0",
    });
    advanced = withAdvancedChange(advanced, ADVANCED_FIELDS.attributes, {
      type: "remove",
      key: "0",
    });
    expect(advanced).toBeUndefined();
  });

  it("leaves the options as they were for anything a site file wouldn't accept", () => {
    const advanced = { anchorId: "prices", attributes: { role: "note" } };

    expect(withAdvancedChange(advanced, ADVANCED_FIELDS.anchorId, "Not An Anchor")).toBe(advanced);
    expect(
      withAdvancedChange(advanced, ADVANCED_FIELDS.attributes, {
        type: "edit",
        key: "0",
        name: "name",
        value: "onclick",
      }),
    ).toBe(advanced);
    expect(withAdvancedChange(advanced, "text", "x")).toBe(advanced);
  });
});
