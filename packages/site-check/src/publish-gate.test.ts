import type { SiteDoc } from "@webforge/model";
import { CATALOGUE } from "@webforge/site-components/catalogue-data";
import { describe, expect, it } from "vitest";
import { blockingCount, checkSite } from "./check.js";
import { publishGate } from "./publish-gate.js";
import { element, siteWith } from "./test-site.test-helper.js";

/** `site` with a web address in Site Settings. */
const addressed = (site: SiteDoc): SiteDoc => ({
  ...site,
  settings: { ...site.settings, address: { url: "https://rosas.example" } },
});

describe("publishGate (ADR 0018 §4)", () => {
  it("counts what must be fixed to publish: stricter than an export", () => {
    const site = siteWith();
    const exportBlocks = blockingCount(checkSite({ site, catalogue: CATALOGUE }, "export"));

    // No web address: only a tip for an export, a Must fix to publish.
    expect(publishGate(site)).toBeGreaterThan(exportBlocks);
    expect(publishGate(site) - publishGate(addressed(site))).toBe(1);
  });

  it("allows an allowed external address only once the owner confirmed the list (#649)", () => {
    const widget = element("CustomCode", "widget", {
      code: '<script src="https://cdn.example.com/widget.js"></script>',
    });
    const base = addressed(siteWith([widget]));
    const site: SiteDoc = {
      ...base,
      settings: { ...base.settings, allowedExternalUrls: ["https://cdn.example.com/"] },
    };

    expect(publishGate(site) - publishGate(site, { allowListConfirmed: true })).toBe(1);
  });
});
