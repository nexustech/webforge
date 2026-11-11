import {
  type CollectionId,
  PAGE_DESCRIPTION_MAX,
  PAGE_SLUG_MAX,
  PAGE_TITLE_MAX,
  type PageId,
} from "@webforge/model";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { insertBlog } from "./blog-actions.js";
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
              hideFromSearch: false,
              privacy: hidden,
              draft: hidden,
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
        hideFromSearch: false,
        privacy: false,
        draft: false,
      }),
    );
    expect("issues" in result ? result.issues : []).toEqual([
      expect.objectContaining({ path: ["title"], message: "Fill this in." }),
    ]);
  });
});

describe("Page Settings for a post (6.10a)", () => {
  it("shows the post's Date, Summary, Picture and Tags after its title, and saves them as its entry", () => {
    const site = starterSite();
    insertBlog(site, "blog" as CollectionId, "post" as PageId, "2026-11-10");
    const post = site.pages["post" as PageId];
    if (post === undefined) throw new Error("no post");
    const spec = pageSettingsSpec(site, post);
    const values = {
      title: "Spring",
      slug: "",
      description: "",
      shareImage: undefined,
      hideHeader: false,
      hideFooter: false,
      hideFromNavigation: false,
      hideBackToTop: false,
      hideFromSearch: false,
      privacy: false,
      draft: false,
      "item.date": "2026-12-01",
      "item.summary": "  Open  ",
      "item.picture": undefined,
      "item.tags": " News, Opening times ",
    };
    const fields = typeof spec.fields === "function" ? spec.fields(values) : spec.fields;

    expect(fields.slice(0, 5).map((field) => [field.name, field.label])).toEqual([
      ["title", "Title"],
      ["item.date", "Date"],
      ["item.summary", "Summary"],
      ["item.picture", "Picture"],
      ["item.tags", "Tags"],
    ]);
    // A post's Blog lists it: it has no navigation toggle of its own.
    expect(fields.some((field) => field.name === "hideFromNavigation")).toBe(false);
    const result = spec.schema["~standard"].validate(spec.toModel(values));
    expect("value" in result ? result.value.entry : undefined).toEqual({
      date: "2026-12-01",
      summary: "Open",
      picture: "",
      tags: "News, Opening times",
    });
  });
});
