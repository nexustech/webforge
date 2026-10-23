import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  breakpointForWidth,
  isResponsiveValue,
  resolveResponsive,
  responsiveSchema,
} from "./responsive.js";

const padding = responsiveSchema(z.enum(["small", "medium", "large"]));

describe("resolveResponsive", () => {
  it("returns a plain value in every view", () => {
    expect(resolveResponsive("large", "desktop")).toBe("large");
    expect(resolveResponsive("large", "mobile")).toBe("large");
  });

  it("falls back from Mobile to Tablet to Desktop", () => {
    const tabletOnly = { $responsive: { desktop: "large", tablet: "medium" } };
    const all = { $responsive: { desktop: "large", tablet: "medium", mobile: "small" } };

    expect(resolveResponsive(tabletOnly, "desktop")).toBe("large");
    expect(resolveResponsive(tabletOnly, "tablet")).toBe("medium");
    expect(resolveResponsive(tabletOnly, "mobile")).toBe("medium");
    expect(resolveResponsive({ $responsive: { desktop: "large" } }, "mobile")).toBe("large");
    expect(resolveResponsive(all, "mobile")).toBe("small");
  });
});

describe("breakpointForWidth", () => {
  it("gives the device whose values a page shows at a width, from Tailwind's md and lg", () => {
    expect([375, 767, 768, 1023, 1024, 1440].map(breakpointForWidth)).toEqual([
      "mobile",
      "mobile",
      "tablet",
      "tablet",
      "desktop",
      "desktop",
    ]);
  });
});

describe("isResponsiveValue", () => {
  it("tells per-device values from plain ones, including null and other objects", () => {
    expect(isResponsiveValue({ $responsive: { desktop: 1 } })).toBe(true);
    expect(isResponsiveValue(1)).toBe(false);
    expect(isResponsiveValue<unknown>(null)).toBe(false);
    expect(isResponsiveValue<unknown>({ desktop: 1 })).toBe(false);
  });
});

describe("responsiveSchema", () => {
  it("accepts plain and per-device values", () => {
    expect(padding.parse("small")).toBe("small");
    const value = { $responsive: { desktop: "large", mobile: "small" } };
    expect(padding.parse(value)).toEqual(value);
  });

  it("rejects invalid values in any view, a missing desktop value and unknown views", () => {
    expect(padding.safeParse("huge").success).toBe(false);
    expect(padding.safeParse({ $responsive: { desktop: "large", mobile: "huge" } }).success).toBe(
      false,
    );
    expect(padding.safeParse({ $responsive: { tablet: "large" } }).success).toBe(false);
    expect(padding.safeParse({ $responsive: { desktop: "large", watch: "small" } }).success).toBe(
      false,
    );
  });
});
