import { describe, expect, it } from "vitest";
import {
  isNodeDoc,
  layoutDocSchema,
  pageDocSchema,
  siteCodeSchema,
  themeSchema,
} from "./documents.js";

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

describe("node options", () => {
  const node = (props: Record<string, unknown>) => ({
    root: { props: {} },
    content: [{ type: "Heading", props: { id: "h", ...props } }],
  });

  it("accepts a Layers label, the hidden flag and Advanced options", () => {
    const page = node({
      label: "Opening times",
      hidden: true,
      advanced: {
        className: "mt-4 md:w-1/2 text-[13px]",
        attributes: { "data-track": "hero", "aria-label": "Intro", role: "note" },
        anchorId: "opening-times",
      },
    });

    expect(pageDocSchema.parse(page)).toEqual(page);
  });

  it.each([
    ["an event handler", { attributes: { onclick: "alert(1)" } }],
    ["an inline style", { attributes: { style: "color:red" } }],
    ["a link target", { attributes: { href: "javascript:alert(1)" } }],
    ["markup in class names", { className: 'a" onload="x' }],
    ["doubled spaces in class names", { className: "a  b" }],
    ["an invalid anchor", { anchorId: "Opening Times" }],
    ["an unknown option", { css: "x" }],
  ])("rejects %s", (_name, advanced) => {
    expect(pageDocSchema.safeParse(node({ advanced })).success).toBe(false);
  });
});

describe("siteCodeSchema", () => {
  it("accepts the four code documents and nothing else", () => {
    const code = { css: "a{}", js: "", head: "<meta>", bodyEnd: "" };

    expect(siteCodeSchema.parse(code)).toEqual(code);
    expect(siteCodeSchema.safeParse({ ...code, php: "" }).success).toBe(false);
  });
});
