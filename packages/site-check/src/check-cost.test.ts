import { insertPage, type PageId, type SiteDoc } from "@webforge/model";
import { CATALOGUE } from "@webforge/site-components/catalogue-data";
import { largePage } from "@webforge/test-utils";
import { scaledTestTimeout } from "@webforge/test-utils/vitest";
import { describe, expect, it } from "vitest";
import { SITE_CHECK_RULES } from "./check.js";
import { siteWith } from "./test-site.test-helper.js";

/** Node's, which Vitest runs in; the package itself has no Node types (it runs in the renderer). */
declare const process: {
  cpuUsage(since?: { user: number; system: number }): { user: number; system: number };
};

/**
 * What one rule may cost on a large site, in copies of that site (#677): a copy through JSON reads
 * every value of the site, as a rule's walk does, and takes about 4 ms on a development machine,
 * so three copies is within a frame's 16 ms (ADR 0016). The costliest rule, *Placeholder text*,
 * is about two copies: one that becomes three times slower fails.
 *
 * Measured against the copy, timed on the same runner in alternating batches, rather than against
 * a fixed 16 ms: how fast or how busy a runner is then cancels out, which an absolute limit on
 * CI's slower runners didn't (17.2 ms on Windows, #677).
 */
const COPIES = 3;

/**
 * A rule measured at under this many copies in one quick pair of batches is well within
 * {@link COPIES}; only the others are measured more closely.
 */
const CLEARLY_WITHIN = COPIES / 2;

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
 * The CPU time one run of `run` takes, in ms, over as many runs as add up to `minMs`: Windows
 * counts CPU time in steps of about 16 ms, so a batch can read up to a step short, a third of a
 * 50 ms batch and under a tenth of a 200 ms one.
 */
function perRun(run: () => unknown, minMs: number): number {
  const start = process.cpuUsage();
  let runs = 0;
  let used = 0;
  do {
    run();
    runs++;
    const now = process.cpuUsage(start);
    used = (now.user + now.system) / 1000;
  } while (used < minMs);
  return used / runs;
}

const median = (values: readonly number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? Number.NaN;

/**
 * What `run` costs in runs of `reference`: the median of `pairs` ratios, each of a batch of one
 * timed right after a batch of the other, so a runner that slows down or speeds up meanwhile
 * slows both alike.
 */
function inReferences(run: () => unknown, reference: () => unknown, pairs: number, minMs: number) {
  const ratios: number[] = [];
  for (let pair = 0; pair < pairs; pair++) {
    ratios.push(perRun(run, minMs) / perRun(reference, minMs));
  }
  return median(ratios);
}

describe("the cost of a check (ADR 0016)", () => {
  // About 4 s of CPU time, in batches each long enough to measure: more on a busy machine.
  it(
    "runs each rule over five large pages in at most three copies of the site",
    () => {
      const site = largeSite(5);
      const input = { site, catalogue: CATALOGUE };
      const copy = () => JSON.parse(JSON.stringify(site));
      // Warmed up first: the first runs of anything are the slowest, while it is compiled.
      perRun(copy, 50);
      const costs = SITE_CHECK_RULES.map((rule) => {
        const check = () => rule.check(input);
        perRun(check, 20);
        const quick = inReferences(check, copy, 1, 50);
        return {
          rule: rule.id,
          copies: quick < CLEARLY_WITHIN ? quick : inReferences(check, copy, 3, 200),
        };
      });
      const all = costs.map(({ rule, copies }) => `${rule} ${copies.toFixed(2)}`).join(", ");

      for (const { rule, copies } of costs) {
        expect(copies, `${rule} cost ${copies.toFixed(2)} copies (${all})`).toBeLessThan(COPIES);
      }
    },
    scaledTestTimeout(30_000),
  );
});
