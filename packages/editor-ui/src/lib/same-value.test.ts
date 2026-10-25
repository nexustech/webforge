import { describe, expect, it } from "vitest";
import { sameValue } from "./same-value.js";

describe("sameValue", () => {
  it("compares plain values by what they hold, whatever the order of their keys", () => {
    expect(sameValue({ a: 1, b: [1, { c: "x" }] }, { b: [1, { c: "x" }], a: 1 })).toBe(true);
    expect(sameValue([1, 2], [2, 1])).toBe(false);
    expect(sameValue([], {})).toBe(false);
    expect(sameValue(null, {})).toBe(false);
  });

  it("tells a key set to undefined from one left out", () => {
    expect(sameValue({ a: undefined }, {})).toBe(false);
  });
});
