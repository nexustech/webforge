import { siteDocSchema, siteSnapshotSchema, siteToSnapshot } from "@webforge/model";
import { starterPage } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import { starterSite } from "./starter-site.js";

describe("starterSite", () => {
  it("is a valid site with the starter page as its home page", () => {
    const site = starterSite();

    expect(siteDocSchema.parse(site)).toEqual(site);
    expect(site.pages[site.homePageId]?.doc).toEqual(starterPage());
    expect(site.layout.header[0]?.props.siteName).toBe("My site");
  });

  it("exports as the home page and a 'Page not found' page", () => {
    const snapshot = siteToSnapshot(starterSite(), new Map());

    expect(siteSnapshotSchema.parse(snapshot)).toEqual(snapshot);
    expect(snapshot.pages.map((page) => [page.path, page.title])).toEqual([
      ["index", "My site"],
      ["404", "Page not found"],
    ]);
  });
});
