import { describe, expect, it } from "vitest";
import { isDeepEqual } from "./deep-equal.js";

describe("isDeepEqual", () => {
  it.each([
    [1, 1, true],
    [Number.NaN, Number.NaN, true],
    ["a", "b", false],
    [null, {}, false],
    [{}, null, false],
    [1, "1", false],
    [[1, [2]], [1, [2]], true],
    [[1], [1, 2], false],
    [[1], { 0: 1 }, false],
    [{ 0: 1 }, [1], false],
    [{ a: { b: 1 } }, { a: { b: 1 } }, true],
    [{ a: 1 }, { a: 1, b: 2 }, false],
    [{ a: 1, b: undefined }, { a: 1, c: undefined }, false],
    [{ a: 1 }, { a: 2 }, false],
  ])("compares %o and %o", (a, b, expected) => {
    expect(isDeepEqual(a, b)).toBe(expected);
  });
});
