// Security review S6 (docs/reviews/2026-10-30-security-review.md), restored by #649.
import type { SiteSnapshot } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { sampleSite } from "@webforge/test-utils";
import { scaledTestTimeout } from "@webforge/test-utils/vitest";
import { describe, expect, it } from "vitest";
import type { BuiltSite } from "../src/build.js";
import { loadNodeResources } from "../src/node-resources.js";
import { createPipeline } from "../src/pipeline.js";

describe("security: preview of an untrusted site's scripts", () => {
  it(
    "leaves custom.js out of a preview while the site's scripts haven't been enabled",
    async () => {
      const resources = await loadNodeResources();
      const snapshot: SiteSnapshot = {
        ...sampleSite(),
        code: {
          css: "",
          head: "",
          bodyEnd: "",
          js: "fetch('http://127.0.0.1:3000/api', { method: 'POST', mode: 'no-cors' });",
        },
      };
      const pipeline = createPipeline(siteLibrary);
      let site: BuiltSite | undefined;
      for await (const event of pipeline.build(snapshot, resources, { mode: "preview" })) {
        if (event.stage === "done") site = event.site;
      }
      if (site === undefined) throw new Error("The preview didn't finish");
      const custom = [...site.files.keys()].filter((path) => /^assets\/js\/custom\./.test(path));
      expect(custom).toEqual([]);
      expect(new TextDecoder().decode(site.files.get("index.html"))).not.toContain("custom.");
    },
    scaledTestTimeout(120_000),
  );
});
