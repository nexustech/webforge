import { describe, expect, it } from "vitest";
import { looksSchema } from "./look.js";
import { DEFAULT_THEME, themeTokensSchema } from "./theme.js";

describe("looks (3.12, CT-1)", () => {
  it("holds each kind's Appearance and hover values, once or per device, as an item stores them", () => {
    const looks = {
      Button: {
        lookCorners: "full",
        lookItalic: true,
        lookShadow: { $responsive: { desktop: "medium", mobile: "none" } },
        hover: "lift",
      },
      CallToAction: { lookBackground: "primary-700/90" },
    };

    expect(looksSchema.parse(looks)).toEqual(looks);
    expect(themeTokensSchema.parse({ ...DEFAULT_THEME, looks }).looks).toEqual(looks);
    // A theme without looks is as it was.
    expect(themeTokensSchema.parse(DEFAULT_THEME).looks).toBeUndefined();
  });

  it("holds the theme's colours only: a custom colour belongs to its item (ADR 0009)", () => {
    expect(looksSchema.safeParse({ Button: { lookColor: "[#1f6feb]" } }).success).toBe(false);
    expect(
      looksSchema.safeParse({
        Button: { lookBackground: { $responsive: { desktop: "primary", mobile: "[#1F6FEB]/50" } } },
      }).success,
    ).toBe(false);
  });

  it("refuses a field that isn't the Appearance group's, and a kind that isn't a component's name", () => {
    expect(looksSchema.safeParse({ Button: { label: "Go" } }).success).toBe(false);
    expect(looksSchema.safeParse({ button: { lookCorners: "full" } }).success).toBe(false);
    expect(looksSchema.safeParse({ Button: { lookCorners: { desktop: "full" } } }).success).toBe(
      false,
    );
  });
});
