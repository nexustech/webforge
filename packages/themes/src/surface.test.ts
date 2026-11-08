import { createSite, type NodeDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { inverseColors } from "./colors.js";
import { surfaceAt, surfaceOf } from "./surface.js";

const text = (id: string, props: Record<string, unknown> = {}): NodeDoc => ({
  type: "Text",
  props: { id, text: "<p>Hi</p>", ...props },
});

/** A site whose home page holds `content`. */
function siteWith(content: NodeDoc[]) {
  return createSite({
    name: "Bakery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Not found",
    homeDoc: { root: { props: {} }, content },
  });
}

describe("what text is drawn on (#670)", () => {
  it("is the page's surface, a Reversed section's, or the nearest Appearance background", () => {
    const site = siteWith([
      { type: "Section", props: { id: "plain", content: [text("onPage")] } },
      {
        type: "Section",
        props: {
          id: "band",
          colors: "inverse",
          content: [text("reversed"), text("filled", { lookBackground: "primary" })],
        },
      },
    ]);
    const on = site.homePageId;
    const { colors } = site.theme;
    const inverse = inverseColors(site.theme);

    expect(surfaceAt(site, on, "onPage")).toEqual({
      palette: "colors",
      background: colors["base-100"],
    });
    expect(surfaceAt(site, on, "reversed")).toEqual({
      palette: "inverse",
      background: inverse["base-100"],
    });
    // A background in a Reversed section is that palette's colour.
    expect(surfaceAt(site, on, "filled")).toEqual({
      palette: "inverse",
      background: inverse.primary,
    });
    // Not there: the page's.
    expect(surfaceAt(site, on, "gone").background).toEqual(colors["base-100"]);
  });

  it("is over a picture under a section's background picture, unless nearer has a background", () => {
    const picture = { mediaId: "loaves" };
    const site = siteWith([
      {
        type: "Section",
        props: {
          id: "photo",
          backgroundImage: picture,
          lookBackground: "primary",
          content: [text("onPhoto"), text("boxed", { lookBackground: "secondary" })],
        },
      },
    ]);
    const on = site.homePageId;

    // Drawn over the section's own colour: the picture is what's behind.
    expect(surfaceAt(site, on, "onPhoto").overPicture).toBe(true);
    // An element's own background is drawn over the picture: measured on that.
    expect(surfaceAt(site, on, "boxed")).toEqual({
      palette: "colors",
      background: site.theme.colors.secondary,
    });
    // Not a picture: no image there.
    expect(surfaceOf(site.theme, [{ backgroundImage: "" }]).overPicture).toBeUndefined();
  });

  it("reads a background a kind's look gives, unless the element sets its own", () => {
    const site = siteWith([text("looked"), text("own", { lookBackground: "theme" })]);
    site.theme.looks = { Text: { lookBackground: "secondary" } };
    const on = site.homePageId;

    expect(surfaceAt(site, on, "looked").background).toEqual(site.theme.colors.secondary);
    expect(surfaceAt(site, on, "own").background).toEqual(site.theme.colors["base-100"]);
  });

  it("takes a background set per device as the desktop has it", () => {
    const { theme } = siteWith([]);
    const surface = surfaceOf(theme, [
      { lookBackground: { $responsive: { desktop: "accent", mobile: "primary" } } },
    ]);

    expect(surface.background).toEqual(theme.colors.accent);
  });
});
