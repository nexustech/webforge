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
