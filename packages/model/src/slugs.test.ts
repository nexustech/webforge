import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RESERVED_SLUGS, slugSchema } from "./site-doc.js";
import { slugify, uniqueSlug } from "./slugs.js";

describe("slugify (X1)", () => {
  it.each([
    ["About us", "about-us"],
    ["Café Menü", "cafe-menu"],
    ["  Opening  times!  ", "opening-times"],
    ["FAQ / Help", "faq-help"],
    ["2026 Prices", "2026-prices"],
    ["!!!", "page"],
    ["日本語", "page"],
  ])("turns %j into %j", (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });

  it("keeps long names within 80 characters, without a trailing hyphen", () => {
    const slug = slugify(`${"a".repeat(79)} b`);
    expect(slug).toBe("a".repeat(79));
  });

  it("always gives a valid slug", () => {
    fc.assert(
      fc.property(fc.string({ unit: "grapheme", maxLength: 120 }), (name) => {
        expect(slugSchema.safeParse(slugify(name)).success).toBe(true);
      }),
    );
  });
});

describe("uniqueSlug", () => {
  it("keeps a free slug and numbers a taken or reserved one", () => {
    expect(uniqueSlug("about", new Set())).toBe("about");
    expect(uniqueSlug("about", new Set(["about", "about-2"]))).toBe("about-3");
    expect(uniqueSlug("index", new Set())).toBe("index-2");
    expect(uniqueSlug("assets", new Set())).toBe("assets-2");
  });

  it("shortens a long slug to make room for the number", () => {
    const long = "a".repeat(80);
    expect(uniqueSlug(long, new Set([long]))).toBe(`${"a".repeat(78)}-2`);
  });

  it("always gives a valid, free slug, so pages added one by one never clash", () => {
    fc.assert(
      fc.property(fc.array(fc.string({ maxLength: 90 }), { maxLength: 30 }), (names) => {
        const taken = new Set<string>();
        for (const name of names) {
          const slug = uniqueSlug(slugify(name), taken);
          expect(slugSchema.safeParse(slug).success).toBe(true);
          expect(RESERVED_SLUGS.has(slug)).toBe(false);
          expect(taken.has(slug)).toBe(false);
          taken.add(slug);
        }
      }),
    );
  });
});
