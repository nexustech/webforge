import { siteSnapshotSchema } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { heroPhoto, sampleSite } from "./sample-site.js";

describe("sampleSite", () => {
  it("is a valid site snapshot with a home page, an about page and a thank-you page", () => {
    const site = siteSnapshotSchema.parse(sampleSite());

    expect(site.pages.map((page) => page.path)).toEqual(["index", "about", "thanks"]);
  });

  it("includes the hero photo as a JPEG", () => {
    const photo = heroPhoto();

    // JPEG files start with the SOI marker FF D8.
    expect([photo[0], photo[1]]).toEqual([0xff, 0xd8]);
    expect(sampleSite().media[0]?.data).toEqual(photo);
  });
});
