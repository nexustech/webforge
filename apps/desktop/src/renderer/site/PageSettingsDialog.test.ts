import { PAGE_DESCRIPTION_MAX, PAGE_SLUG_MAX, PAGE_TITLE_MAX } from "@webforge/model";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { pageSettingsSpec } from "./PageSettingsDialog.js";

describe("Page Settings checked by the model (2.21, decision 5)", () => {
  it("saves every page the dialog could save before: any title, file name and description", () => {
    const site = starterSite();
    const page = Object.values(site.pages).find((each) => each.id !== site.homePageId);
    if (page === undefined) throw new Error("No page to set");
    const spec = pageSettingsSpec(site, page);
    fc.assert(
      fc.property(
        // What the fields let through: a title that isn't blank, within the inputs' limits.
        fc
          .string({ minLength: 1, maxLength: PAGE_TITLE_MAX })
          .filter((title) => title.trim() !== ""),
        fc.string({ maxLength: PAGE_SLUG_MAX }),
        fc.string({ maxLength: PAGE_DESCRIPTION_MAX }),
        fc.boolean(),
        (title, slug, description, hidden) => {
          const result = spec.schema["~standard"].validate(
            spec.toModel({
              title,
              slug,
              description,
              shareImage: undefined,
              hideHeader: hidden,
              hideFooter: !hidden,
              hideFromNavigation: hidden,
              hideBackToTop: hidden,
            }),
          );
          expect(result).not.toBeInstanceOf(Promise);
          expect("issues" in result ? result.issues : undefined).toBeUndefined();
        },
      ),
    );
  });

  it("says a blank title can't be saved, in the editor's words", () => {
    const site = starterSite();
    const page = Object.values(site.pages).find((each) => each.id !== site.homePageId);
    if (page === undefined) throw new Error("No page to set");
    const spec = pageSettingsSpec(site, page);
    const result = spec.schema["~standard"].validate(
      spec.toModel({
        title: "  ",
        slug: "",
        description: "",
        shareImage: undefined,
        hideHeader: false,
        hideFooter: false,
        hideFromNavigation: false,
        hideBackToTop: false,
      }),
    );
    expect("issues" in result ? result.issues : []).toEqual([
      expect.objectContaining({ path: ["title"], message: "Fill this in." }),
    ]);
  });
});
