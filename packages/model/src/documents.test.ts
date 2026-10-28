import { describe, expect, it } from "vitest";
import {
  isNodeDoc,
  layoutDocSchema,
  pageDocSchema,
  siteCodeSchema,
  themeSchema,
} from "./documents.js";
import { DEFAULT_THEME } from "./theme.js";

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

describe("unsafe keys (#138)", () => {
  // As a crafted file would arrive: JSON.parse makes "__proto__" an own key.
  const page = (props: string) =>
    JSON.parse(
      `{"root": {"props": {}}, "content": [{"type": "Section", "props": {"id": "s", "content": [{"type": "Heading", "props": {"id": "h", ${props}}}]}}]}`,
    ) as unknown;

  it("refuses a document with __proto__, constructor or prototype at any depth", () => {
    for (const key of ["__proto__", "constructor", "prototype"]) {
      const result = pageDocSchema.safeParse(page(`"x": {"${key}": {"polluted": true}}`));
      expect(result.success, key).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(`Documents may not contain a "${key}" key`);
    }
    expect(
      pageDocSchema.safeParse(JSON.parse('{"root": {"props": {"__proto__": {}}}, "content": []}'))
        .success,
    ).toBe(false);
    expect(
      layoutDocSchema.safeParse(
        JSON.parse(
          '{"header": [{"type": "Header", "props": {"id": "h", "prototype": 1}}], "footer": []}',
        ),
      ).success,
    ).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("doesn't loop on a cyclic value, as structured clone (IPC) can deliver", () => {
    const loop: Record<string, unknown> = { name: "loop" };
    loop.self = loop;
    const cyclic = {
      root: { props: {} },
      content: [{ type: "Heading", props: { id: "h", loop } }],
    };
    const withUnsafeKey = {
      root: { props: { loop } },
      content: [{ type: "Heading", props: { id: "h", x: { constructor: 1 } } }],
    };

    expect(pageDocSchema.safeParse(cyclic).success).toBe(true);
    expect(pageDocSchema.safeParse(withUnsafeKey).success).toBe(false);
  });

  it("still accepts such words as values and inside longer keys", () => {
    const ok = page(`"text": "__proto__", "constructorName": "x"`);

    expect(pageDocSchema.safeParse(ok).success).toBe(true);
  });
});

describe("themeSchema", () => {
  it("is the theme's tokens: a format 4 theme's name no longer passes (2.1)", () => {
    expect(themeSchema.parse(DEFAULT_THEME)).toEqual(DEFAULT_THEME);
    expect(themeSchema.safeParse({ name: "light" }).success).toBe(false);
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

  it("accepts a Layers name, the hidden flag and Advanced options", () => {
    const page = node({
      layerName: "Opening times",
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

  it("accepts files kept with the site from https:// addresses, each address once (3.9)", () => {
    const code = { css: "", js: "", head: "", bodyEnd: "" };
    const file = {
      url: "https://cdn.example.com/lib.js",
      file: "lib.js",
      hash: "a".repeat(64),
      mime: "text/javascript",
    };

    expect(siteCodeSchema.parse({ ...code, bundled: [file] })).toEqual({
      ...code,
      bundled: [file],
    });
    // Two addresses of one file share it.
    const mirror = { ...file, url: "https://mirror.example.com/lib.js" };
    expect(siteCodeSchema.safeParse({ ...code, bundled: [file, mirror] }).success).toBe(true);
    for (const bundled of [
      [{ ...file, url: "http://cdn.example.com/lib.js" }],
      [{ ...file, file: "../lib.js" }],
      [file, { ...file, hash: "b".repeat(64) }],
    ]) {
      expect(siteCodeSchema.safeParse({ ...code, bundled }).success).toBe(false);
    }
  });
});
