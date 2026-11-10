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

describe("binding fields in a Blog's design (6.10a)", () => {
  const itemFields = [
    { name: "date", label: "Date", kind: "date" },
    { name: "summary", label: "Summary", kind: "text" },
    { name: "picture", label: "Picture", kind: "image" },
  ] as const;
  const text = siteLibrary.components.Text?.fields.text;
  const image = siteLibrary.components.Image?.fields.image;

  it("offers a text the post's title, date and summary, and a picture its picture", () => {
    if (heading === undefined || text === undefined || image === undefined) {
      throw new Error("missing fields");
    }
    const values = (fields: ReturnType<typeof withBindingChoice>) => {
      const [choice] = fields;
      return choice?.kind === "select" ? choice.options.map((option) => option.value) : [];
    };

    expect(values(withBindingChoice("text", heading, undefined, own, itemFields))).toEqual(
      expect.arrayContaining(["", "contact.phone", "item.title", "item.date", "item.summary"]),
    );
    expect(values(withBindingChoice("text", text, undefined, own, itemFields))).toEqual([
      "",
      "item.title",
      "item.date",
      "item.summary",
    ]);
    expect(values(withBindingChoice("image", image, undefined, own, itemFields))).toEqual([
      "",
      "item.picture",
    ]);
    // Outside a design, a Text and a picture have no choice.
    expect(withBindingChoice("text", text, undefined, own)).toEqual(own);
  });

  it("shows only the choice while bound to the post, and binds and unbinds", () => {
    if (text === undefined) throw new Error("Text has no text field");

    const fields = withBindingChoice("text", text, { text: "item.summary" }, own, itemFields);

    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({ value: "item.summary" });
    expect(withBinding(undefined, "text", "item.date")).toEqual({ text: "item.date" });
    expect(withBinding({ text: "item.date" }, "text", "")).toBeUndefined();
    expect(bindingLabel("Text", "item.date")).toBe("Text shows the post's date");
  });
});
