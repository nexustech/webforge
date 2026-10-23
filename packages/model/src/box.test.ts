import { describe, expect, it } from "vitest";
import { boxValueOf, boxValueSchema, responsiveBoxOf } from "./box.js";

describe("box values (1.32)", () => {
  it("accepts a token per side, and nothing else", () => {
    expect(boxValueSchema.safeParse({ top: "s", left: "xl" }).success).toBe(true);
    expect(boxValueSchema.safeParse({}).success).toBe(true);
    expect(boxValueSchema.safeParse({ top: "huge" }).success).toBe(false);
    expect(boxValueSchema.safeParse({ middle: "s" }).success).toBe(false);
    // The old form is read, never written.
    expect(boxValueSchema.safeParse("medium").success).toBe(false);
  });

  it("reads a padding saved before 1.32 as the top and the bottom", () => {
    expect(boxValueOf("small")).toEqual({ top: "s", bottom: "s" });
    expect(boxValueOf("medium")).toEqual({ top: "m", bottom: "m" });
    expect(boxValueOf("large")).toEqual({ top: "l", bottom: "l" });
    expect(boxValueOf({ right: "none" })).toEqual({ right: "none" });
  });

  it("reads anything else as every side unset", () => {
    expect(boxValueOf(undefined)).toEqual({});
    expect(boxValueOf("huge")).toEqual({});
    expect(boxValueOf({ top: 3 })).toEqual({});
  });

  it("reads each device's value of a box set per device", () => {
    expect(responsiveBoxOf("large")).toEqual({ top: "l", bottom: "l" });
    expect(responsiveBoxOf({ $responsive: { desktop: "large", mobile: { left: "s" } } })).toEqual({
      $responsive: { desktop: { top: "l", bottom: "l" }, mobile: { left: "s" } },
    });
    expect(responsiveBoxOf({ $responsive: { desktop: {}, tablet: "small" } })).toEqual({
      $responsive: { desktop: {}, tablet: { top: "s", bottom: "s" } },
    });
  });
});
