import { insertPage, type PageId, type SiteDoc } from "@webforge/model";
import { CATALOGUE } from "@webforge/site-components/catalogue-data";
import { largePage } from "@webforge/test-utils";
import { describe, expect, it } from "vitest";
import { SITE_CHECK_RULES } from "./check.js";
import { siteWith } from "./test-site.test-helper.js";
import type { CheckRule } from "./types.js";

/** Node's, which Vitest runs in; the package itself has no Node types (it runs in the renderer). */
declare const process: {
  cpuUsage(since?: { user: number; system: number }): { user: number; system: number };
  readonly env: Readonly<Record<string, string | undefined>>;
};

/**
 * The CPU time one rule may take on a large site: a frame (16 ms) on CI's runners, as the panel
 * runs its rules one by one in the renderer's idle time (ADR 0016). Elsewhere three times that, as
 * ADR 0014 allows a development machine.
 */
const BUDGET_MS = 16 * (process.env.CI === "true" ? 1 : 3);

/** A site of `pages` large pages (ADR 0007's fixture: 225 elements each). */
function largeSite(pages: number): SiteDoc {
  const site = siteWith(largePage().content);
  for (let n = 2; n <= pages; n++) {
    const id = `page-${n}` as PageId;
    insertPage(site, id, `Page ${n}`);
    const page = site.pages[id];
    if (page !== undefined) site.pages[id] = { ...page, doc: largePage() };
  }
  return site;
}

/**
 * The CPU time `rule` takes to check `site`, in ms: the mean of `runs`, once warmed up. Many runs,
 * as Windows counts CPU time in steps of about 16 ms.
 */
function cpuTime(rule: CheckRule, site: SiteDoc, runs = 20): number {
  const input = { site, catalogue: CATALOGUE };
  rule.check(input);
  const start = process.cpuUsage();
  for (let run = 0; run < runs; run++) rule.check(input);
  const used = process.cpuUsage(start);
  return (used.user + used.system) / 1000 / runs;
}

describe("the cost of a check (ADR 0016)", () => {
  it("runs each rule over five large pages within a frame's CPU time", () => {
    const site = largeSite(5);
    const times = SITE_CHECK_RULES.map((rule) => ({ rule: rule.id, ms: cpuTime(rule, site) }));
    const all = times.map(({ rule, ms }) => `${rule} ${ms.toFixed(1)}`).join(", ");

    for (const { rule, ms } of times) {
      expect(ms, `${rule} took ${ms.toFixed(1)} ms (${all})`).toBeLessThan(BUDGET_MS);
    }
  });
});
