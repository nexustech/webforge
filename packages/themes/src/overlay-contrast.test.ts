import { DEFAULT_THEME } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { AA_TEXT, overlayContrast, overlayContrastIssue } from "./contrast.js";
import { THEME_PRESETS } from "./presets.js";

describe("overlayContrast (2.26)", () => {
  it("is the worse of the overlay over black and over white, stronger as it covers more", () => {
    const at = (opacity: number) => overlayContrast(DEFAULT_THEME, { color: "base", opacity });

    // No overlay: the text over a photo can be as dark as itself.
    expect(at(0)).toBeLessThan(1.5);
    expect(at(0.4)).toBeLessThan(at(0.6));
    expect(at(0.6)).toBeLessThan(at(0.8));
    expect(at(1)).toBeGreaterThan(AA_TEXT);
  });

  it("checks a reversed section in the reversed colours", () => {
    const page = overlayContrast(DEFAULT_THEME, { color: "base", opacity: 0.8 });
    const reversed = overlayContrast(DEFAULT_THEME, { color: "base", opacity: 0.8, inverse: true });

    expect(reversed).not.toBe(page);
  });

  it("warns below AA, rounding down so it never shows as passing", () => {
    expect(overlayContrastIssue(DEFAULT_THEME, { color: "base", opacity: 0.2 })).toEqual({
      ratio: expect.any(Number),
      required: AA_TEXT,
    });
    expect(overlayContrastIssue(DEFAULT_THEME, { color: "base", opacity: 1 })).toBeNull();
  });

  it("passes for every theme at the strongest overlay, in either colour", () => {
    for (const theme of THEME_PRESETS) {
      for (const color of ["base", "neutral"] as const) {
        expect(
          overlayContrast(theme, { color, opacity: 0.8 }),
          `${theme.preset} ${color}`,
        ).toBeGreaterThanOrEqual(AA_TEXT);
      }
    }
  });
});
