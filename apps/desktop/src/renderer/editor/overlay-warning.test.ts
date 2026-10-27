import { DEFAULT_THEME } from "@webforge/model";
import { BACKGROUND_FIELDS, siteLibrary } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import { overlayWarning } from "./overlay-warning.js";

const withImage = { backgroundImage: { mediaId: "shop" } };

describe("overlayWarning (2.26)", () => {
  it("warns that the text may be hard to read over a weak overlay", () => {
    expect(
      overlayWarning(BACKGROUND_FIELDS.overlay, { ...withImage, overlay: "20" }, DEFAULT_THEME),
    ).toMatch(
      /^The text may be hard to read on some images: its contrast can fall to [\d.]+:1, below the 4\.5:1/,
    );
  });

  it("says nothing over a strong one, without an image, or for another field", () => {
    expect(
      overlayWarning(BACKGROUND_FIELDS.overlay, { ...withImage, overlay: "80" }, DEFAULT_THEME),
    ).toBeUndefined();
    expect(
      overlayWarning(BACKGROUND_FIELDS.overlay, { overlay: "0" }, DEFAULT_THEME),
    ).toBeUndefined();
    const title = siteLibrary.components.TextSection?.fields.title;
    if (title === undefined) throw new Error("The Text section has no title");
    expect(overlayWarning(title, { ...withImage, overlay: "0" }, DEFAULT_THEME)).toBeUndefined();
  });

  it("checks the text a section's layout draws: a Call to action Banner's neutral-content (#544)", () => {
    const cta = siteLibrary.components.CallToAction;
    if (cta === undefined) throw new Error("No Call to action");
    const banner = { ...cta.defaults, ...withImage, variant: "banner", overlay: "80" };
    const warn = (values: Readonly<Record<string, unknown>>) =>
      overlayWarning(BACKGROUND_FIELDS.overlay, values, DEFAULT_THEME, cta);

    // Its light text over a strong layer of the light page colour: hard to read.
    expect(warn({ ...banner, overlayColor: "base" })).toMatch(/^The text may be hard to read/);
    // Over the neutral colour, as now: neutral-content on neutral.
    expect(warn({ ...banner, overlayColor: "neutral" })).toBeUndefined();
    // The Split layout draws the page's text, as any other section: as before.
    expect(warn({ ...banner, variant: "split", overlayColor: "base" })).toBeUndefined();
    // Text the person coloured is checked in their colour, whatever the layout draws.
    expect(warn({ ...banner, overlayColor: "base", lookColor: "base-content" })).toBeUndefined();
  });
});
