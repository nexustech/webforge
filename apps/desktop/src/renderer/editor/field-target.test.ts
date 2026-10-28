import type { SiteDoc } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { fieldTarget } from "./field-target.js";

/** The starter site with a Button on its home page, and the theme's `looks`. */
function siteWithButton(looks?: NonNullable<SiteDoc["theme"]["looks"]>): SiteDoc {
  const site = starterSite();
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  home.doc.content.push({ type: "Button", props: { id: "book", label: "Book now" } });
  return looks === undefined ? site : { ...site, theme: { ...site.theme, looks } };
}

describe("fieldTarget's storedOr (3.12, CT-1)", () => {
  it("reads a field the element doesn't set from its kind's look, before its default", () => {
    const site = siteWithButton({ Button: { lookCorners: "full" } });
    const target = fieldTarget(site, siteLibrary, site.homePageId, "book");

    expect(target?.storedOr("lookCorners", undefined)).toBe("full");
    // Its own value wins over the look.
    expect(target?.storedOr("lookCorners", "small")).toBe("small");
    // A field the look doesn't set has the component's default, as before.
    expect(target?.storedOr("style", undefined)).toBe(
      siteLibrary.components.Button?.defaults.style,
    );
  });

  it("reads the component's default without a look for the kind", () => {
    const site = siteWithButton();

    expect(
      fieldTarget(site, siteLibrary, site.homePageId, "book")?.storedOr("lookCorners", undefined),
    ).toBe(siteLibrary.components.Button?.defaults.lookCorners);
  });
});
