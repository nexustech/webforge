import { describe, expect, it } from "vitest";
import { fieldsHiddenBy } from "../library.js";
import { siteLibrary } from "./index.js";

describe("the Header's Highlight the section in view (5.10b, GA10-1)", () => {
  const header = siteLibrary.components.Header;
  if (header === undefined) throw new Error("no Header");

  it("is on by default, with help text under it", () => {
    expect(header.defaults.sectionHighlight).toBe(true);
    expect(header.fields.sectionHighlight).toMatchObject({
      kind: "toggle",
      label: "Highlight the section in view",
      help: "As visitors scroll, the menu lights up the section they're looking at.",
    });
  });

  it("shows only while the menu links to a section, keeping its value while hidden", () => {
    const values = { ...header.defaults, sectionHighlight: false };

    expect(
      fieldsHiddenBy(header, values, { menuLinksToSections: true }).has("sectionHighlight"),
    ).toBe(false);
    expect(
      fieldsHiddenBy(header, values, { menuLinksToSections: false }).has("sectionHighlight"),
    ).toBe(true);
    // Without the site, as Theme Studio asks: as a menu without sections.
    expect(fieldsHiddenBy(header, values).has("sectionHighlight")).toBe(true);
  });
});

describe("the Header's logo (HF-1, 5.37)", () => {
  const header = siteLibrary.components.Header;
  if (header === undefined) throw new Error("no Header");

  it("offers where and how big only once Site Settings hold a logo, in place of the name at first", () => {
    expect(header.defaults).toMatchObject({ logoPlace: "instead", logoSize: "medium" });
    const hidden = (hasLogo?: boolean) =>
      fieldsHiddenBy(header, header.defaults, { menuLinksToSections: false, hasLogo });

    for (const field of ["logoPlace", "logoSize"]) {
      expect(hidden(true).has(field)).toBe(false);
      expect(hidden(false).has(field)).toBe(true);
      expect(hidden().has(field)).toBe(true);
    }
    // The site's name says where the logo is chosen.
    expect(header.fields.siteName?.help).toBe(
      "To show your logo here, choose it in Site Settings, under General.",
    );
  });
});
