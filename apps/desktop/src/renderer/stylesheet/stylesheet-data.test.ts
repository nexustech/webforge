import type { SharedSectionId, SiteDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { sessionWith } from "../testing/fixtures.js";
import { stylesheetFacts } from "./stylesheet-data.js";

describe("stylesheetFacts (6.8)", () => {
  it("offers every anchor a link can go to: the pages', shared copies' and the Footer's", () => {
    const HOURS = "shared-hours" as SharedSectionId;
    const site: SiteDoc = structuredClone(starterSite());
    const home = site.pages[site.homePageId];
    if (home === undefined) throw new Error("No home page");
    site.sharedSections[HOURS] = {
      id: HOURS,
      name: "Hours",
      section: {
        type: "Section",
        props: { id: "s", advanced: { anchorId: "hours" }, content: [] },
      },
    };
    home.doc.content.push(
      { type: "SharedSectionCopy", props: { id: "c1", sharedSectionId: HOURS } },
      { type: "SharedSectionCopy", props: { id: "c2", sharedSectionId: HOURS, anchorSuffix: "2" } },
    );
    site.layout.footer.push({
      type: "Text",
      props: { id: "small-print", text: "<p>Small print</p>", advanced: { anchorId: "legal" } },
    });

    const { data } = stylesheetFacts(site, sessionWith(site), undefined);

    expect(data.ids).toEqual(expect.arrayContaining(["hours", "hours-2", "legal"]));
  });

  it("offers Tailwind's variables after the theme's, and plain class names only", () => {
    const site = starterSite();

    const { data } = stylesheetFacts(site, sessionWith(site), {
      classes: ["md:flex", "[&_a]:underline", "shadow-lg"],
      variants: ["md"],
      variables: ["--text-xl", "--color-primary"],
    });

    expect(data.variables).toContain("--text-xl");
    expect(data.variables.filter((name) => name === "--color-primary")).toHaveLength(1);
    expect(data.variables.indexOf("--color-primary")).toBeLessThan(
      data.variables.indexOf("--text-xl"),
    );
    expect(data.classes).toContain("shadow-lg");
    expect(data.classes).not.toContain("md:flex");
    expect(data.classes).not.toContain("[&_a]:underline");
  });
});
