import { themePreset } from "@webforge/themes";
import { describe, expect, it } from "vitest";
import { element, findIn, siteWith } from "../test-site.test-helper.js";
import { contrastRule, underlinedTextRule } from "./look.js";

/** A theme every pair of which passes AA, with Accent (`secondary`) light enough to fail as text. */
function themeWithLightAccent() {
  const theme = themePreset("high-contrast-rounded");
  if (theme === undefined) throw new Error("no high-contrast preset");
  return {
    passing: theme,
    light: { ...theme, colors: { ...theme.colors, secondary: { l: 0.9, c: 0.05, h: 90 } } },
  };
}

describe("contrast", () => {
  it("passes a theme whose pairs pass, with brand-coloured text", () => {
    const { passing } = themeWithLightAccent();
    const site = siteWith(
      [element("Text", "brand", { text: '<p><span class="text-primary">Fresh</span></p>' })],
      {
        theme: passing,
      },
    );

    expect(findIn(contrastRule, site)).toEqual([]);
  });

  it("lists the theme's failing pairs, and text coloured with a colour that fails as text", () => {
    const { light } = themeWithLightAccent();
    const site = siteWith(
      [
        element("Text", "accent", {
          text: '<p><span class="text-secondary">Fresh</span> <span class="text-secondary">bread</span></p>',
        }),
        element("Text", "washed", { text: '<p><span class="bg-accent/30">Fresh</span></p>' }),
      ],
      { theme: light },
    );
    const found = findIn(contrastRule, site);

    expect(found.filter((finding) => finding.place.kind === "theme").length).toBeGreaterThan(0);
    expect(found.filter((finding) => finding.place.kind === "element")).toEqual([
      {
        key: `${site.homePageId}/accent/text/secondary`,
        place: { kind: "element", on: site.homePageId, nodeId: "accent" },
        values: { foreground: "secondary", ratio: expect.any(Number), required: 4.5 },
      },
    ]);
  });
});

describe("underlined text (2.25)", () => {
  it("finds underlined rich text and elements underlined in their Appearance, but not links", () => {
    const site = siteWith([
      element("Text", "marked", { text: "<p><u>Open late</u></p>" }),
      element("Heading", "styled", {
        text: "Hours",
        lookUnderline: { $responsive: { desktop: false, mobile: true } },
      }),
      element("Text", "both", { text: "<p><u>Both</u></p>", lookUnderline: true }),
      element("Button", "button", { label: "Menu", lookUnderline: true }),
      element("Heading", "plain", { text: "Hours", lookUnderline: false }),
      element("Text", "hidden", { text: "<p><u>Gone</u></p>", hidden: true }),
    ]);
    const on = site.homePageId;

    expect(findIn(underlinedTextRule, site)).toEqual([
      { key: `${on}/marked`, place: { kind: "element", on, nodeId: "marked" } },
      { key: `${on}/both`, place: { kind: "element", on, nodeId: "both" } },
      { key: `${on}/styled`, place: { kind: "element", on, nodeId: "styled" } },
    ]);
  });
});
