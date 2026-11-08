import { createSite, type NodeDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { inverseColors } from "./colors.js";
import { surfaceAt, surfaceOf } from "./surface.js";

const text = (id: string, props: Record<string, unknown> = {}): NodeDoc => ({
  type: "Text",
  props: { id, text: "<p>Hi</p>", ...props },
});

/** No element draws a picture behind its content. */
const NO_PICTURE = () => false;

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

    expect(surfaceAt(site, on, "onPage", NO_PICTURE)).toEqual({
      palette: "colors",
      background: colors["base-100"],
    });
    expect(surfaceAt(site, on, "reversed", NO_PICTURE)).toEqual({
      palette: "inverse",
      background: inverse["base-100"],
    });
    // A background in a Reversed section is that palette's colour.
    expect(surfaceAt(site, on, "filled", NO_PICTURE)).toEqual({
      palette: "inverse",
      background: inverse.primary,
    });
    // Not there: the page's.
    expect(surfaceAt(site, on, "gone", NO_PICTURE).background).toEqual(colors["base-100"]);
  });

  it("is over a picture where the library says one is drawn, unless nearer has a background", () => {
    const site = siteWith([
      {
        type: "Section",
        props: {
          id: "photo",
          backgroundImage: { mediaId: "loaves" },
          lookBackground: "primary",
          content: [text("onPhoto"), text("boxed", { lookBackground: "secondary" })],
        },
      },
    ]);
    const on = site.homePageId;
    // As the library would say: the section draws its background image behind its content.
    const sectionPicture = (node: NodeDoc) => node.type === "Section";

    // Drawn over the section's own colour: the picture is what's behind.
    expect(surfaceAt(site, on, "onPhoto", sectionPicture).overPicture).toBe(true);
    // An element's own background is drawn over the picture: measured on that.
    expect(surfaceAt(site, on, "boxed", sectionPicture)).toEqual({
      palette: "colors",
      background: site.theme.colors.secondary,
    });
    // Nothing drawn behind: the section's colour.
    expect(surfaceAt(site, on, "onPhoto", NO_PICTURE)).toEqual({
      palette: "colors",
      background: site.theme.colors.primary,
    });
    // By place in the chain: the first layer draws one, the second has none of its own.
    expect(surfaceOf(site.theme, [{}, {}], (at) => at === 0).overPicture).toBe(true);
    expect(surfaceOf(site.theme, [{}]).overPicture).toBeUndefined();
  });

  it("reads a background a kind's look gives, unless the element sets its own", () => {
    const site = siteWith([text("looked"), text("own", { lookBackground: "theme" })]);
    site.theme.looks = { Text: { lookBackground: "secondary" } };
    const on = site.homePageId;

    expect(surfaceAt(site, on, "looked", NO_PICTURE).background).toEqual(
      site.theme.colors.secondary,
    );
    expect(surfaceAt(site, on, "own", NO_PICTURE).background).toEqual(
      site.theme.colors["base-100"],
    );
  });

  it("takes a background set per device as the desktop has it", () => {
    const { theme } = siteWith([]);
    const surface = surfaceOf(theme, [
      { lookBackground: { $responsive: { desktop: "accent", mobile: "primary" } } },
    ]);

    expect(surface.background).toEqual(theme.colors.accent);
  });
});
