import { describe, expect, it } from "vitest";
import { boxValueOf, boxValueSchema, responsiveBoxOf } from "./box.js";

describe("box values (1.32)", () => {
  it("accepts a token per side, and nothing else", () => {
    expect(boxValueSchema.safeParse({ top: "s", left: "xl" }).success).toBe(true);
    expect(boxValueSchema.safeParse({}).success).toBe(true);
    expect(boxValueSchema.safeParse({ top: "huge" }).success).toBe(false);
    expect(boxValueSchema.safeParse({ middle: "s" }).success).toBe(false);
    // The old form is migrated by format 6, never read here.
    expect(boxValueSchema.safeParse("medium").success).toBe(false);
  });

  it("reads a box as it is", () => {
    expect(boxValueOf({ right: "none" })).toEqual({ right: "none" });
  });

  it("reads anything else, a padding size from before format 6 too, as every side unset", () => {
    expect(boxValueOf(undefined)).toEqual({});
    expect(boxValueOf("medium")).toEqual({});
    expect(boxValueOf("huge")).toEqual({});
    expect(boxValueOf({ top: 3 })).toEqual({});
  });

  it("reads each device's value of a box set per device", () => {
    expect(responsiveBoxOf({ top: "l" })).toEqual({ top: "l" });
    expect(
      responsiveBoxOf({ $responsive: { desktop: { top: "l" }, mobile: { left: "s" } } }),
    ).toEqual({ $responsive: { desktop: { top: "l" }, mobile: { left: "s" } } });
    expect(responsiveBoxOf({ $responsive: { desktop: {}, tablet: "small" } })).toEqual({
      $responsive: { desktop: {}, tablet: {} },
    });
  });
});
