import { EDITOR_RENDER_CONTEXT, renderNodesToHtml, siteLibrary } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import { previewNode } from "./StudioComponents.js";

/** As the canvas and the item previews draw: a button without a link greyed, with its hint. */
const canvas = { ...EDITOR_RENDER_CONTEXT, elementHint: () => "[hint]" };

describe("Theme Studio's sample nodes (#1256)", () => {
  it("draws each kind's buttons as links, as on a site, not greyed for want of one", () => {
    for (const type of ["Button", "Hero", "CallToAction", "Pricing"]) {
      const html = renderNodesToHtml([previewNode(siteLibrary, type)], siteLibrary, canvas);

      expect(html, type).toMatch(/<a class="btn/);
      expect(html, type).not.toContain("btn-disabled");
      expect(html, type).not.toContain("[hint]");
    }
  });

  it("gives the same node each time, so its drawing is kept", () => {
    expect(previewNode(siteLibrary, "Hero")).toBe(previewNode(siteLibrary, "Hero"));
  });
});
