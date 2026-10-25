import { siteDocSchema, siteSnapshotSchema, siteToSnapshot } from "@webforge/model";
import { starterNotFoundPage, starterPage } from "@webforge/site-components";
import { themePreset } from "@webforge/themes";
import { describe, expect, it } from "vitest";
import { starterSite } from "./starter-site.js";

describe("starterSite", () => {
  it("is a valid site with the starter page as its home page", () => {
    const site = starterSite();

    expect(siteDocSchema.parse(site)).toEqual(site);
    expect(site.pages[site.homePageId]?.doc).toEqual(starterPage());
    expect(site.layout.header[0]?.props.siteName).toBe("My site");
    const notFound = Object.values(site.pages).find((page) => page.kind === "not-found");
    expect(notFound?.doc).toEqual(starterNotFoundPage());
  });

  it("exports as the home page and a 'Page not found' page", () => {
    const snapshot = siteToSnapshot(starterSite(), new Map());

    expect(siteSnapshotSchema.parse(snapshot)).toEqual(snapshot);
    expect(snapshot.pages.map((page) => [page.path, page.title])).toEqual([
      ["index", "My site"],
      ["404", "Page not found"],
    ]);
  });

  it("is named and in the theme New Site asked for (2.14a)", () => {
    const bistro = themePreset("bistro");
    if (bistro === undefined) throw new Error("No bistro preset");
    const site = starterSite({ name: "Rosa's Bakery", theme: bistro });

    expect(site.settings.general.name).toBe("Rosa's Bakery");
    expect(site.layout.header[0]?.props.siteName).toBe("Rosa's Bakery");
    expect(site.pages[site.homePageId]?.title).toBe("Rosa's Bakery");
    expect(site.theme).toEqual(bistro);
    expect(site.theme).not.toBe(bistro);
  });
});
