import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import {
  bindingLabel,
  boundFieldOf,
  isBindingField,
  withBinding,
  withBindingChoice,
} from "./binding-fields.js";

const heading = siteLibrary.components.Heading?.fields.text;
const size = siteLibrary.components.Heading?.fields.size;
const own = [
  { name: "text", kind: "text", label: "Text", group: "content", value: "Welcome" },
] as const;

describe("binding fields", () => {
  it("offers a bindable text field's choices before its own text", () => {
    if (heading === undefined) throw new Error("Heading has no text field");

    const fields = withBindingChoice("text", heading, undefined, own);

    expect(fields.map((field) => field.name)).toEqual(["text:shows", "text"]);
    expect(fields[0]).toMatchObject({
      kind: "select",
      label: "Text shows",
      value: "",
      options: expect.arrayContaining([
        { label: "Text typed here", value: "" },
        { label: "Phone number", value: "contact.phone" },
      ]),
    });
  });

  it("hides the field's own text while it shows a Site Settings value", () => {
    if (heading === undefined) throw new Error("Heading has no text field");

    const fields = withBindingChoice("text", heading, { text: "contact.phone" }, own);

    expect(fields.map((field) => [field.name, field.value])).toEqual([
      ["text:shows", "contact.phone"],
    ]);
  });

  it("leaves other fields alone", () => {
    if (size === undefined) throw new Error("Heading has no size field");
    expect(withBindingChoice("size", size, undefined, own)).toEqual(own);
  });

  it("sets and clears a field's binding, dropping the prop once nothing is bound", () => {
    expect(withBinding(undefined, "text", "contact.phone")).toEqual({ text: "contact.phone" });
    expect(withBinding({ text: "contact.phone", other: "general.name" }, "text", "")).toEqual({
      other: "general.name",
    });
    expect(withBinding({ text: "contact.phone" }, "text", "")).toBeUndefined();
    expect(withBinding("broken", "text", "contact.fax")).toBeUndefined();
    // Another field's binding this version doesn't know is dropped; the valid ones stay.
    expect(withBinding({ siteName: "general.name", x: "y" }, "text", "contact.phone")).toEqual({
      siteName: "general.name",
      text: "contact.phone",
    });
    expect(isBindingField("text:shows")).toBe(true);
    expect(isBindingField("text")).toBe(false);
    expect(boundFieldOf("text:shows")).toBe("text");
  });

  it("names the step by what the field now shows", () => {
    expect(bindingLabel("Heading", "contact.phone")).toBe("Heading shows Phone number");
    expect(bindingLabel("Heading", "")).toBe("Heading shows its own text");
  });
});
