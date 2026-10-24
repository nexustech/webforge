import { describe, expect, it } from "vitest";
import { samePreviews } from "./previews.js";

describe("samePreviews (UX-26)", () => {
  it("compares what is on, taking a preview left out as off", () => {
    expect(samePreviews({}, { mobileMenu: false })).toBe(true);
    expect(samePreviews({ mobileMenu: true }, { mobileMenu: true })).toBe(true);
    expect(samePreviews({}, { mobileMenu: true })).toBe(false);
  });
});
