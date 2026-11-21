import { describe, expect, it } from "vitest";
import { nodeDocSchema } from "./documents.js";
import { clearExample, exampleFields, isExample, markExamples } from "./examples.js";

describe("example marks (#1228, WN-3)", () => {
  it("marks fields, says which are marked, and clears one at a time", () => {
    const props: { examples?: Record<string, true> } = {};
    expect(isExample(props, "quote")).toBe(false);

    markExamples(props, ["quote", "name"]);
    expect(isExample(props, "quote")).toBe(true);
    expect(exampleFields(props)).toEqual(["quote", "name"]);

    expect(clearExample(props, "quote")).toBe(true);
    expect(props.examples).toEqual({ name: true });
    // Nothing to clear: no change.
    expect(clearExample(props, "quote")).toBe(false);
    // The last one cleared, no empty record is left behind.
    expect(clearExample(props, "name")).toBe(true);
    expect(props).toEqual({});
  });

  it("adds no record when nothing is marked", () => {
    const props: { examples?: Record<string, true> } = {};
    markExamples(props, []);
    expect(props).toEqual({});
  });

  it("is stored on a node, and nothing but a field marked true passes", () => {
    const node = (examples: unknown) => ({ type: "Text", props: { id: "t", text: "x", examples } });
    expect(nodeDocSchema.safeParse(node({ text: true })).success).toBe(true);
    expect(nodeDocSchema.safeParse(node({ "items.2.text": true })).success).toBe(true);
    expect(nodeDocSchema.safeParse(node({ text: false })).success).toBe(false);
    expect(nodeDocSchema.safeParse(node({ "": true })).success).toBe(false);
    expect(nodeDocSchema.safeParse(node(["text"])).success).toBe(false);
  });
});
