import type { SiteDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { element, findIn, siteWith } from "../test-site.test-helper.js";
import { unusedCssRulesRule } from "./css.js";

const withCss = (site: SiteDoc, code: Partial<SiteDoc["code"]>): SiteDoc => ({
  ...site,
  code: { ...site.code, ...code },
});

const usedSelectors = { classes: new Set(["btn", "hero"]), ids: new Set(["about"]) };

describe("unusedCssRules (CT-8, 6.8)", () => {
  it("finds each rule of the stylesheet that matches nothing on the site", () => {
    const site = withCss(siteWith(), { css: ".btn { } .buton { color: red } #team { }" });

    expect(findIn(unusedCssRulesRule, site, { usedSelectors })).toEqual([
      {
        key: "code/css/.buton",
        place: { kind: "code", part: "css" },
        values: { selector: ".buton" },
      },
      {
        key: "code/css/#team",
        place: { kind: "code", part: "css" },
        values: { selector: "#team" },
      },
    ]);
  });

  it("counts a class the site's own code names as used, as its script may add it", () => {
    const site = withCss(
      siteWith([element("CustomCode", "c", { code: '<div id="team"></div>' })]),
      {
        css: ".is-open { } #team { }",
        js: 'menu.classList.add("is-open");',
      },
    );

    expect(findIn(unusedCssRulesRule, site, { usedSelectors })).toEqual([]);
  });

  it("checks nothing without the site's classes", () => {
    const site = withCss(siteWith(), { css: ".buton { }" });

    expect(findIn(unusedCssRulesRule, site)).toEqual([]);
  });
});
