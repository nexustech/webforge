import { describe, expect, it } from "vitest";
import { isNodeDoc, layoutDocSchema, pageDocSchema, themeSchema } from "./documents.js";

const heading = { type: "Heading", props: { id: "heading-1", text: "Hello", size: "large" } };

describe("pageDocSchema", () => {
  it("accepts a page and keeps component-specific props", () => {
    const page = {
      root: { props: {} },
      content: [{ type: "Section", props: { id: "section-1", content: [heading] } }],
    };

    expect(pageDocSchema.parse(page)).toEqual(page);
  });

  it("rejects nodes without a type or an id", () => {
    expect(() =>
      pageDocSchema.parse({ root: { props: {} }, content: [{ type: "", props: { id: "a" } }] }),
    ).toThrow();
    expect(() =>
      pageDocSchema.parse({ root: { props: {} }, content: [{ type: "Heading", props: {} }] }),
    ).toThrow();
  });
});

describe("layoutDocSchema", () => {
  it("accepts a header and a footer", () => {
    const layout = { header: [heading], footer: [] };

    expect(layoutDocSchema.parse(layout)).toEqual(layout);
  });
});

describe("themeSchema", () => {
  it.each(["light", "cupcake", "corporate-2"])("accepts the theme name %s", (name) => {
    expect(themeSchema.parse({ name })).toEqual({ name });
  });

  it.each(["", "Light", "dark mode", "../x", "-x"])("rejects the theme name %j", (name) => {
    expect(() => themeSchema.parse({ name })).toThrow();
  });
});

describe("isNodeDoc", () => {
  it("recognises nodes", () => {
    expect(isNodeDoc(heading)).toBe(true);
  });

  it.each([null, "Heading", { type: "Heading" }, { type: 1, props: { id: "a" } }, { props: {} }])(
    "rejects %j",
    (value) => {
      expect(isNodeDoc(value)).toBe(false);
    },
  );
});
