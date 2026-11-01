import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { sameJson } from "./same-json.js";

/** `value` with every object's keys in reverse order. */
function reversed(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reversed);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, inner]) => [key, reversed(inner)]),
  );
}

describe("sameJson (A18)", () => {
  it("is what JSON makes of a value: the same whatever the key order", () => {
    fc.assert(
      fc.property(fc.jsonValue(), (value) => {
        expect(sameJson(value, reversed(value))).toBe(true);
        expect(sameJson(value, JSON.parse(JSON.stringify(value)))).toBe(true);
      }),
    );
  });

  it("is different exactly when the JSON text, keys sorted, is", () => {
    const sorted = (value: unknown): string =>
      JSON.stringify(value, (_key, inner: unknown) =>
        typeof inner === "object" && inner !== null && !Array.isArray(inner)
          ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => (a < b ? -1 : 1)))
          : inner,
      );
    fc.assert(
      fc.property(fc.jsonValue(), fc.jsonValue(), (a, b) => {
        expect(sameJson(a, b)).toBe(sorted(a) === sorted(b));
      }),
    );
  });

  it("counts a property set to undefined as none, as the stored site does", () => {
    expect(sameJson({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(sameJson({ a: 1 }, { a: 1, b: undefined })).toBe(true);
    expect(sameJson({ a: undefined }, {})).toBe(true);
    expect(sameJson({ a: undefined }, { b: undefined })).toBe(true);
    expect(sameJson({ a: undefined }, { a: null })).toBe(false);
  });

  it("tells arrays from objects, and their lengths and order apart", () => {
    expect(sameJson([1, 2], [2, 1])).toBe(false);
    expect(sameJson([1], [1, 2])).toBe(false);
    expect(sameJson([1], { 0: 1 })).toBe(false);
    expect(sameJson({ 0: 1 }, [1])).toBe(false);
    expect(sameJson([], {})).toBe(false);
    expect(sameJson(null, {})).toBe(false);
    expect(sameJson(undefined, null)).toBe(false);
    expect(sameJson(undefined, undefined)).toBe(true);
    expect(sameJson(0, -0)).toBe(true);
  });
});
