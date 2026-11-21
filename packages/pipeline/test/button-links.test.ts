import { siteLibrary } from "@webforge/site-components";
import { sampleSite } from "@webforge/test-utils";
import { scaledTestTimeout } from "@webforge/test-utils/vitest";
import { beforeAll, describe, expect, it } from "vitest";
import { buildSite } from "../src/build.js";
import { loadNodeResources } from "../src/node-resources.js";
import type { PipelineResources } from "../src/resources.js";

// Timeouts (#1052): loading the pipeline's Node resources and building a site take seconds alone,
// several times that on a busy machine, so each sets its own, scaled to the run (ADR 0014).

let resources: PipelineResources;

beforeAll(async () => {
  resources = await loadNodeResources();
}, scaledTestTimeout(120_000));

describe("buttons without a link in the export (#1256)", () => {
  it(
    "leaves each one out, never a link to #, and keeps one with a link",
    async () => {
      const site = sampleSite();
      const [home, ...rest] = site.pages;
      if (home === undefined) throw new Error("The sample site has no pages");
      const added = [
        { type: "Hero", props: { id: "hero", title: "Cakes", buttonLabel: "Unlinked hero" } },
        {
          type: "CallToAction",
          props: { id: "cta", title: "Order", buttonLabel: "Unlinked banner", buttonLink: "" },
        },
        { type: "Button", props: { id: "none", label: "Unlinked button", link: " " } },
        { type: "Button", props: { id: "linked", label: "Linked button", link: "about" } },
      ];
      const built = await buildSite(
        {
          ...site,
          pages: [
            { ...home, doc: { ...home.doc, content: [...home.doc.content, ...added] } },
            ...rest,
          ],
        },
        siteLibrary,
        resources,
      );
      const index = new TextDecoder().decode(built.files.get("index.html"));

      expect(index).not.toContain("Unlinked");
      // Back to top's is the only link to `#`, as it goes to the top of the page.
      expect([...index.matchAll(/<a [^>]*href="#"[^>]*>/g)].map(([tag]) => tag)).toEqual([
        expect.stringContaining('aria-label="Back to top"'),
      ]);
      expect(index).toMatch(/<a class="btn[^"]*" href="about\.html"[^>]*>Linked button<\/a>/);
    },
    scaledTestTimeout(60_000),
  );
});
