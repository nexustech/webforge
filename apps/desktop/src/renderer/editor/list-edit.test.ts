import type { NodeDoc } from "@webforge/model";
import { type FieldDef, siteLibrary } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import { applyListChange, editableList, listChangeLabel, listItems } from "./list-edit.js";

const testimonials: FieldDef = {
  kind: "list",
  label: "Testimonials",
  itemLabel: "Testimonial",
  fields: {
    quote: { kind: "text", label: "Quote" },
    rating: { kind: "select", label: "Rating", options: [{ label: "Five", value: "5" }] },
  },
  defaults: { quote: "Lovely", rating: "5" },
};

const questions = siteLibrary.components.Faq?.fields.items;

function faqItem(id: string, question: string): NodeDoc {
  return { type: "FaqItem", props: { id, question, answer: "<p>Yes</p>" } };
}

const noText = () => "unused";

describe("editableList", () => {
  it("edits a list field's items and fields", () => {
    expect(editableList(testimonials, siteLibrary)).toMatchObject({
      holds: "items",
      itemLabel: "Testimonial",
      defaults: { quote: "Lovely" },
    });
  });

  it("edits a slot of one component type as a list of those elements, with their plain fields", () => {
    if (questions === undefined) throw new Error("no FAQ items");
    const list = editableList(questions, siteLibrary);

    expect(list).toMatchObject({ holds: "elements", type: "FaqItem", itemLabel: "Question" });
    // The answer is rich text, edited on the canvas.
    expect(Object.keys(list?.fields ?? {})).toEqual(["question"]);
  });

  it("leaves other fields alone: plain values, slots of several types, unknown types", () => {
    const content = siteLibrary.components.Section?.fields.content;
    if (content === undefined) throw new Error("no Section content");

    expect(editableList({ kind: "text", label: "Text" }, siteLibrary)).toBeUndefined();
    expect(editableList(content, siteLibrary)).toBeUndefined();
    expect(
      editableList({ kind: "slot", label: "Things", allow: ["NoSuchComponent"] }, siteLibrary),
    ).toBeUndefined();
  });
});

describe("list items and changes", () => {
  const plain = editableList(testimonials, siteLibrary);
  const elements = questions === undefined ? undefined : editableList(questions, siteLibrary);
  if (plain === undefined || elements === undefined) throw new Error("no lists");

  it("shows items by their ids, skipping anything that isn't one", () => {
    expect(listItems([{ id: "a", quote: "Hi" }, "junk", { quote: "no id" }], plain)).toEqual([
      { id: "a", quote: "Hi" },
    ]);
    expect(listItems([faqItem("q1", "Open?"), { id: "x" }], elements)).toEqual([
      { id: "q1", question: "Open?", answer: "<p>Yes</p>" },
    ]);
    expect(listItems(undefined, plain)).toEqual([]);
  });

  it("adds an item with the defaults and a new id, as a plain value or an element", () => {
    const items: unknown[] = [];
    const nodes: unknown[] = [];

    applyListChange(items, { type: "add" }, plain);
    applyListChange(nodes, { type: "add" }, elements);

    expect(items).toEqual([{ id: expect.any(String), quote: "Lovely", rating: "5" }]);
    expect(nodes).toEqual([
      {
        type: "FaqItem",
        props: expect.objectContaining({ id: expect.any(String), question: expect.any(String) }),
      },
    ]);
  });

  it("moves, edits and removes an item by its id", () => {
    const nodes: unknown[] = [faqItem("a", "A?"), faqItem("b", "B?"), faqItem("c", "C?")];

    expect(applyListChange(nodes, { type: "move", id: "a", to: 2 }, elements)).toBe(true);
    expect(listItems(nodes, elements).map((item) => item.id)).toEqual(["b", "c", "a"]);
    applyListChange(nodes, { type: "edit", id: "c", name: "question", value: "See?" }, elements);
    expect((nodes[1] as NodeDoc).props.question).toBe("See?");
    applyListChange(nodes, { type: "remove", id: "b" }, elements);

    expect(listItems(nodes, elements).map((item) => item.id)).toEqual(["c", "a"]);
  });

  it("changes nothing for a gone item or a move out of the list", () => {
    const items: unknown[] = [{ id: "a" }, { id: "b" }];

    expect(applyListChange(items, { type: "remove", id: "zz" }, plain)).toBe(false);
    expect(applyListChange(items, { type: "move", id: "a", to: -1 }, plain)).toBe(false);
    expect(applyListChange(items, { type: "move", id: "b", to: 2 }, plain)).toBe(false);
    expect(applyListChange(items, { type: "move", id: "b", to: 1 }, plain)).toBe(false);
    expect(items).toEqual([{ id: "a" }, { id: "b" }]);
  });

  it("labels each change by the item's name (D2)", () => {
    expect(listChangeLabel({ type: "add" }, elements, noText)).toBe("Added Question");
    expect(listChangeLabel({ type: "move", id: "a", to: 1 }, plain, noText)).toBe(
      "Moved Testimonial",
    );
    expect(listChangeLabel({ type: "remove", id: "a" }, plain, noText)).toBe("Deleted Testimonial");
    expect(
      listChangeLabel({ type: "edit", id: "a", name: "quote", value: "x" }, plain, noText),
    ).toBe("Edited Testimonial quote");
    expect(
      listChangeLabel({ type: "edit", id: "a", name: "rating", value: "5" }, plain, noText),
    ).toBe("Changed Testimonial rating");
    // An element's text is named as the canvas names it.
    expect(
      listChangeLabel(
        { type: "edit", id: "q1", name: "question", value: "x" },
        elements,
        (key, field) => `${key}/${field}`,
      ),
    ).toBe("q1/question");
  });
});
