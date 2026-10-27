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
});
