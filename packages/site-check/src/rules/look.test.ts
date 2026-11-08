import { inverseColors, themePreset } from "@webforge/themes";
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
  it("finds elements underlined by their kind's look, unless one sets its own (#670)", () => {
    const site = siteWith([
      element("Text", "looked", { text: "<p>Open late</p>" }),
      element("Text", "own", { text: "<p>Open late</p>", lookUnderline: false }),
    ]);
    const on = site.homePageId;
    const looked = { ...site, theme: { ...site.theme, looks: { Text: { lookUnderline: true } } } };

    expect(findIn(underlinedTextRule, looked)).toEqual([
      { key: `${on}/looked`, place: { kind: "element", on, nodeId: "looked" } },
    ]);
    expect(findIn(underlinedTextRule, site)).toEqual([]);
  });

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

describe("contrast on what the text is drawn on (#670)", () => {
  it("measures a mark in a Reversed section against the inverse palette", () => {
    const { passing } = themeWithLightAccent();
    const inverse = inverseColors(passing);
    // Brand on the reversed band is the band's own colour: unreadable there, fine on the page.
    const theme = { ...passing, inverse: { ...inverse, primary: inverse["base-100"] } };
    const marked = (id: string) =>
      element("Text", id, { text: '<p><span class="text-primary">Fresh</span></p>' });
    const site = siteWith(
      [
        element("Section", "band", { colors: "inverse", content: [marked("reversed")] }),
        element("Section", "plain", { colors: "page", content: [marked("onPage")] }),
      ],
      { theme },
    );

    const onElements = findIn(contrastRule, site).filter(({ place }) => place.kind === "element");
    expect(onElements).toEqual([
      expect.objectContaining({
        place: { kind: "element", on: site.homePageId, nodeId: "reversed" },
      }),
    ]);
  });

  it("lists text colours below what text of their size needs: 3:1 for a heading, 4.5:1 for text", () => {
    const { passing } = themeWithLightAccent();
    // Accent at about 4:1 on the page: enough for a large heading, not for body text.
    const mid = { ...passing, colors: { ...passing.colors, secondary: { l: 0.6, c: 0, h: 0 } } };
    const midSite = siteWith(
      [
        element("Heading", "heading", { text: "Hours", size: "large", color: "secondary" }),
        element("Text", "text", { text: "<p>Open late</p>", lookColor: "secondary" }),
      ],
      { theme: mid },
    );
    expect(
      findIn(contrastRule, midSite)
        .filter(({ place }) => place.kind === "element")
        .map(({ key, values }) => ({ key, required: values?.required })),
    ).toEqual([{ key: `${midSite.homePageId}/text/lookColor`, required: 4.5 }]);

    // Accent too light even for a heading: below 3:1.
    const { light } = themeWithLightAccent();
    const lightSite = siteWith(
      [element("Heading", "heading", { text: "Hours", size: "large", color: "secondary" })],
      { theme: light },
    );
    expect(findIn(contrastRule, lightSite).filter(({ place }) => place.kind === "element")).toEqual(
      [
        expect.objectContaining({
          key: `${lightSite.homePageId}/heading/color`,
          values: expect.objectContaining({ required: 3 }),
        }),
      ],
    );
  });

  it("holds an Icon's or Social links' colour to graphics' 3:1, by its kind, not text's 4.5:1", () => {
    const { passing } = themeWithLightAccent();
    const accent = (l: number) => ({
      ...passing,
      colors: { ...passing.colors, secondary: { l, c: 0, h: 0 } },
    });
    const icons = [
      element("Icon", "icon", { icon: "phone", color: "secondary" }),
      element("SocialLinks", "social", { color: "secondary" }),
    ];
    // About 3.6:1 on the page: enough for a graphic, though not for text.
    const enough = siteWith(icons, { theme: accent(0.62) });
    expect(findIn(contrastRule, enough).filter(({ place }) => place.kind === "element")).toEqual(
      [],
    );

    // About 2.5:1: too faint even for a graphic, and said to be one.
    const faint = siteWith(icons, { theme: accent(0.72) });
    const on = faint.homePageId;
    expect(
      findIn(contrastRule, faint)
        .filter(({ place }) => place.kind === "element")
        .map(({ key, values }) => ({ key, values })),
    ).toEqual([
      {
        key: `${on}/icon/color`,
        values: { foreground: "secondary", ratio: 2.48, required: 3, drawn: "graphic" },
      },
      {
        key: `${on}/social/color`,
        values: { foreground: "secondary", ratio: 2.48, required: 3, drawn: "graphic" },
      },
    ]);
  });

  it("measures nothing over a section's background picture, but what's boxed on it", () => {
    const { light } = themeWithLightAccent();
    const faint = (id: string, props: Record<string, unknown> = {}) =>
      element("Text", id, {
        text: '<p><span class="text-secondary">Fresh</span></p>',
        lookColor: "secondary",
        ...props,
      });
    const site = siteWith(
      [
        element("Section", "photo", {
          backgroundImage: { mediaId: "loaves" },
          content: [faint("onPhoto"), faint("boxed", { lookBackground: "base-100" })],
        }),
      ],
      { theme: light },
    );

    // Its colours can't be known: white text on a dark photo is no warning, nor dark on light.
    expect(
      findIn(contrastRule, site)
        .filter(({ place }) => place.kind === "element")
        .map(({ key }) => key),
    ).toEqual([`${site.homePageId}/boxed/lookColor`, `${site.homePageId}/boxed/text/secondary`]);
  });

  it("measures nothing on a Hero's picture in its background layout, but in its split one", () => {
    const { light } = themeWithLightAccent();
    const hero = (id: string, variant: string) =>
      element("Hero", id, { variant, image: { mediaId: "loaves" }, lookTitleColor: "secondary" });
    const site = siteWith([hero("behind", "background"), hero("beside", "split")], {
      theme: light,
    });

    // Its title on the picture can't be measured; beside it, it's on the section's colour.
    expect(
      findIn(contrastRule, site)
        .filter(({ place }) => place.kind === "element")
        .map(({ key }) => key),
    ).toEqual([`${site.homePageId}/beside/lookTitleColor`]);
  });

  it("measures an element's text on its own Appearance background", () => {
    const { passing } = themeWithLightAccent();
    const site = siteWith(
      [
        element("Text", "same", {
          text: "<p>Hi</p>",
          lookColor: "primary",
          lookBackground: "primary",
        }),
      ],
      { theme: passing },
    );

    expect(findIn(contrastRule, site).filter(({ place }) => place.kind === "element")).toEqual([
      expect.objectContaining({ key: `${site.homePageId}/same/lookColor` }),
    ]);
  });
});
