import type { ThemeTokens } from "@webforge/model";
import { BACKGROUND_FIELDS, siteLibrary } from "@webforge/site-components";
import { themePreset } from "@webforge/themes";
import { describe, expect, it } from "vitest";
import { placedOverlay } from "./placed-overlay.js";

const preset = (name: string): ThemeTokens => {
  const theme = themePreset(name);
  if (theme === undefined) throw new Error(`No preset ${name}`);
  return theme;
};
/** A new Text section, as the Add panel makes it. */
const fresh = siteLibrary.components.TextSection?.defaults ?? {};
const image = { mediaId: "shop" };
const field = BACKGROUND_FIELDS.backgroundImage;

describe("placedOverlay (2.26, ST-9)", () => {
  it("starts a first image's overlay at the weakest that keeps the text readable in the theme", () => {
    expect(placedOverlay(field, fresh, image, preset("light"))).toBe("60");
    expect(placedOverlay(field, fresh, image, preset("dark"))).toBe("80");
    expect(placedOverlay(field, fresh, image, preset("high-contrast-rounded"))).toBe("60");
    // A section saved before the overlay had a default has none of its own.
    const { overlay: _overlay, ...older } = fresh;
    expect(placedOverlay(field, older, image, preset("dark"))).toBe("80");
  });

  it("checks the section's own colours: reversed, or its overlay in the neutral colour", () => {
    const light = preset("light");
    // Over neutral, light's text needs a very strong overlay (4.18 : 1 at 60%).
    expect(placedOverlay(field, { ...fresh, overlayColor: "neutral" }, image, light)).toBe("80");
    // Reversed, its page colour is dark: it needs a very strong overlay, as the dark theme does.
    expect(placedOverlay(field, { ...fresh, colors: "inverse" }, image, light)).toBe("80");
  });

  it("uses the strongest when none keeps the text readable", () => {
    // A theme whose page and text colours are the same: nothing is readable.
    const light = preset("light");
    const flat = {
      ...light,
      colors: { ...light.colors, "base-content": light.colors["base-100"] },
    };
    expect(placedOverlay(field, fresh, image, flat)).toBe("80");
  });

  it("leaves an overlay the person chose, a section that had an image, and other changes", () => {
    const dark = preset("dark");
    expect(placedOverlay(field, { ...fresh, overlay: "20" }, image, dark)).toBeUndefined();
    expect(placedOverlay(field, { ...fresh, backgroundImage: image }, image, dark)).toBeUndefined();
    // Taking the image away, or none chosen.
    expect(placedOverlay(field, fresh, undefined, dark)).toBeUndefined();
    const title = siteLibrary.components.TextSection?.fields.title;
    if (title === undefined) throw new Error("The Text section has no title");
    expect(placedOverlay(title, fresh, "Our story", dark)).toBeUndefined();
  });
});
