import { describe, expect, it } from "vitest";
import { exportedAddress, exportedSiteAddress, exportedTitle } from "./exported-page.js";

describe("exportedTitle (3.3, 3.16)", () => {
  it("is the site's name alone on the home page, and Page | Site name elsewhere", () => {
    expect(exportedTitle("Rosa's Bakery", "index", "Home")).toBe("Rosa's Bakery");
    expect(exportedTitle("Rosa's Bakery", "services/cakes", "Cakes")).toBe("Cakes | Rosa's Bakery");
  });
});

describe("exportedSiteAddress and exportedAddress (X3)", () => {
  it("takes an address Site Settings accept, without its last slash", () => {
    expect(exportedSiteAddress("https://rosas-bakery.example/")).toBe(
      "https://rosas-bakery.example",
    );
    expect(exportedSiteAddress(undefined)).toBeUndefined();
    expect(exportedSiteAddress("rosas-bakery")).toBeUndefined();
  });

  it("puts each page's file under it, and the home page at the address itself", () => {
    expect(exportedAddress("https://rosas-bakery.example", "index")).toBe(
      "https://rosas-bakery.example/",
    );
    expect(exportedAddress("https://rosas-bakery.example", "services/cakes")).toBe(
      "https://rosas-bakery.example/services/cakes.html",
    );
  });
});
