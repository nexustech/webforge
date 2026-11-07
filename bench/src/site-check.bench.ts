import { checkSite } from "@webforge/site-check";
import { CATALOGUE } from "@webforge/site-components/catalogue-data";
import { describe, test } from "vitest";
import { measure } from "./measure.js";
import { largeSite, PAGES } from "./sites.js";

// Site Check (3.6) runs in the renderer on the open site while its panel is shown, and in main
// before each publish (ADR 0018 §4): the whole of a 20-page site of large pages. §10 sets it no
// budget; it is checked against its baseline only.

describe(`Site Check, a site of ${PAGES} large pages`, () => {
  test("every page checked for publishing", async ({ bench }) => {
    const site = largeSite();
    await measure(bench, "site-check-publish", () => {
      checkSite({ site, catalogue: CATALOGUE }, "publish");
    });
  });
});
