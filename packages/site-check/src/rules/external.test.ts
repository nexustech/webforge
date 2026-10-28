import type { SiteDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { element, findIn, siteWith } from "../test-site.test-helper.js";
import { externalResourcesRule } from "./external.js";

/** `site` with code of its own and the addresses Settings allow. */
const withCode = (site: SiteDoc, code: Partial<SiteDoc["code"]>, allowed: string[] = []) => ({
  ...site,
  code: { ...site.code, ...code },
  settings: { ...site.settings, allowedExternalUrls: allowed },
});

describe("externalResources (C8, 3.9)", () => {
  const widget = element("CustomCode", "widget", {
    code: '<script src="https://cdn.example.com/widget.js"></script><p>Hi</p>',
  });
  const hidden = element("CustomCode", "old", {
    code: '<img src="https://img.example.com/old.png">',
    hidden: true,
  });

  it("finds each file Custom Code and the site's own code load from other websites", () => {
    const site = withCode(siteWith([widget, hidden]), {
      head: '<link rel="stylesheet" href="https://fonts.example.com/inter.css">',
      css: ".hero { background: url(https://img.example.com/hero.jpg); }",
      js: 'loadScript("https://cdn.example.com/chat.js");',
    });
    const home = site.homePageId;

    expect(findIn(externalResourcesRule, site)).toEqual([
      {
        key: `${home}/widget/https://cdn.example.com/widget.js`,
        place: { kind: "element", on: home, nodeId: "widget" },
        values: { url: "https://cdn.example.com/widget.js", kind: "script" },
      },
      {
        key: "code/head/https://fonts.example.com/inter.css",
        place: { kind: "code", part: "head" },
        values: { url: "https://fonts.example.com/inter.css", kind: "style" },
      },
      {
        key: "code/css/https://img.example.com/hero.jpg",
        place: { kind: "code", part: "css" },
        values: { url: "https://img.example.com/hero.jpg", kind: "image" },
      },
      {
        key: "code/js/https://cdn.example.com/chat.js",
        place: { kind: "code", part: "js" },
        values: { url: "https://cdn.example.com/chat.js", kind: "script" },
      },
    ]);
  });

  it("finds nothing the site keeps a copy of, but in custom.js, whose addresses stay as they are", () => {
    const kept = {
      url: "https://cdn.example.com/widget.js",
      file: "widget-1a2b3c4d.js",
      hash: "c".repeat(64),
      mime: "text/javascript",
    };
    const site = withCode(siteWith([widget]), {
      js: 'loadScript("//cdn.example.com/widget.js");',
      bundled: [kept],
    });

    expect(findIn(externalResourcesRule, site).map((found) => found.key)).toEqual([
      "code/js///cdn.example.com/widget.js",
    ]);
  });

  it("finds nothing Settings allow, and stops the export for the rest", () => {
    const site = withCode(siteWith([widget]), {}, ["https://cdn.example.com/"]);

    expect(findIn(externalResourcesRule, site)).toEqual([]);
    expect(externalResourcesRule.level).toBe("must");
  });
});
