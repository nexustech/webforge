import { describe, expect, it } from "vitest";
import { canvasPreviews, createPreviewStore, showsSmallScreens } from "./edit-previews.js";

describe("edit-only previews (UX-26)", () => {
  it("takes the canvas below 768 px for small screens, as the site's own layout does", () => {
    expect(showsSmallScreens("mobile")).toBe(true);
    expect(showsSmallScreens(767)).toBe(true);
    expect(showsSmallScreens("tablet")).toBe(false);
    expect(showsSmallScreens("desktop")).toBe(false);
  });

  it("previews the mobile menu only where the site has one, and column outlines anywhere", () => {
    const on = { mobileMenu: true, columnOutlines: true };
    expect(canvasPreviews(on, "mobile")).toEqual({ mobileMenu: true, columnOutlines: true });
    expect(canvasPreviews(on, "desktop")).toEqual({ mobileMenu: false, columnOutlines: true });
    expect(canvasPreviews({ mobileMenu: false, columnOutlines: false }, "mobile")).toEqual({
      mobileMenu: false,
      columnOutlines: false,
    });
  });

  it("starts with column outlines shown and the mobile menu closed", () => {
    expect(createPreviewStore().getState()).toEqual({ mobileMenu: false, columnOutlines: true });
  });
});
