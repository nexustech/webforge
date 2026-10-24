import { describe, expect, it } from "vitest";
import { canvasPreviews, showsSmallScreens } from "./edit-previews.js";

describe("edit-only previews (UX-26)", () => {
  it("takes the canvas below 768 px for small screens, as the site's own layout does", () => {
    expect(showsSmallScreens("mobile")).toBe(true);
    expect(showsSmallScreens(767)).toBe(true);
    expect(showsSmallScreens("tablet")).toBe(false);
    expect(showsSmallScreens("desktop")).toBe(false);
  });

  it("previews the mobile menu only where the site has one", () => {
    expect(canvasPreviews({ mobileMenu: true }, "mobile")).toEqual({ mobileMenu: true });
    expect(canvasPreviews({ mobileMenu: true }, "desktop")).toEqual({ mobileMenu: false });
    expect(canvasPreviews({ mobileMenu: false }, "mobile")).toEqual({ mobileMenu: false });
  });
});
