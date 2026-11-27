import type { PageId } from "@webforge/model";
import { CATALOGUE } from "@webforge/site-components/catalogue-data";
import { describe, expect, it } from "vitest";
import { blockingCount, checkSite, SITE_CHECK_RULES } from "../check.js";
import { publishGate } from "../publish-gate.js";
import { element, findIn, siteWith } from "../test-site.test-helper.js";
import type { CheckReport } from "../types.js";
import { unpublishedRule } from "./unpublished.js";

/** A home page with a section left out, an element left out inside it, and one in a shown section. */
const leftOut = () =>
  siteWith([
    element("Section", "kept", {
      hidden: true,
      content: [element("Heading", "inner", { text: "Hi", hidden: true })],
    }),
    element("Section", "shown", {
      content: [element("Heading", "own", { text: "Welcome", hidden: true })],
    }),
  ]);

describe("unpublished (#1512)", () => {
  it("lists the outermost element left out, once, and one inside a shown section", () => {
    const site = leftOut();
    expect(findIn(unpublishedRule, site)).toEqual([
      {
        key: `${site.homePageId}/kept`,
        place: { kind: "element", on: site.homePageId, nodeId: "kept" },
      },
      {
        key: `${site.homePageId}/own`,
        place: { kind: "element", on: site.homePageId, nodeId: "own" },
      },
    ]);
  });

  it("leaves out a draft page's, which isn't published anyway", () => {
    const site = siteWith([element("Heading", "h", { text: "Hi" })]);
    const home = site.pages[site.homePageId];
    if (home === undefined) throw new Error("no home page");
    const winter = "winter" as PageId;
    site.pages[winter] = {
      ...home,
      id: winter,
      slug: "winter",
      settings: { ...home.settings, draft: true },
      doc: {
        root: { props: {} },
        content: [element("Heading", "w", { text: "Soon", hidden: true })],
      },
    };
    site.pageOrder.push(winter);
    expect(findIn(unpublishedRule, site)).toEqual([]);
  });

  it("is a tip, listed only while it finds something: never to fix, and Publish doesn't stop on it", () => {
    expect(unpublishedRule.level).toBe("tip");
    expect(unpublishedRule.strictOnPublish).toBeUndefined();
    expect(unpublishedRule.onlyWhenFound).toBe(true);
    const input = { site: leftOut(), catalogue: CATALOGUE };
    const others = SITE_CHECK_RULES.filter((rule) => rule.id !== unpublishedRule.id);
    const toFix = (report: CheckReport) =>
      report.results
        .filter((result) => result.level !== "tip")
        .reduce((count, result) => count + result.findings.length, 0);
    for (const mode of ["export", "publish"] as const) {
      const report = checkSite(input, mode);
      const without = checkSite(input, mode, new Set(), others);
      expect(report.results.find((result) => result.rule === "unpublished")).toMatchObject({
        level: "tip",
        findings: [{ key: expect.any(String) }, { key: expect.any(String) }],
      });
      expect(toFix(report)).toBe(toFix(without));
      expect(blockingCount(report)).toBe(blockingCount(without));
    }
    expect(publishGate(input.site)).toBe(
      blockingCount(checkSite(input, "publish", new Set(), others)),
    );
  });
});
