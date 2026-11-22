import { describe, expect, it } from "vitest";
import { USAGE_COMMANDS } from "../shared/usage.js";
import {
  formatTotals,
  type ReceivedReport,
  readReports,
  reportTotals,
  TIMING_BUDGETS_MS,
} from "./report-totals.js";
import type { UsageLists, UsageSummaryData } from "./usage-summary.js";

/** The names these tests' summaries count by: two kinds of element, a rule and a tool. */
const LISTS: UsageLists = { components: ["Hero", "Text"], rules: ["alt-text"], tools: ["addNode"] };

const A = "0b6f1c1e-6c4a-4c39-9a7e-2f2d8a5a0c11";
const B = "6d2b1a4f-5e3c-4b2a-8f1e-3c4d5e6f7a8b";
const C = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

/** A summary for install `installId`, saved `saved`, with `change` made to it. */
function summary(
  installId: string,
  saved: number,
  change: (data: UsageSummaryData) => void = () => undefined,
): UsageSummaryData {
  const data: UsageSummaryData = {
    version: 1,
    installId,
    since: 0,
    saved,
    sites: {
      started: {},
      templates: {},
      firstEdits: 0,
      siteChecks: 0,
      previews: 0,
      phonePreviews: 0,
      exports: 0,
      published: {},
    },
    quickStart: { created: {}, cancelled: {} },
    tour: { taken: 0, declined: 0, finished: 0, closedAt: [] },
    used: { commands: {}, added: {} },
    failures: { export: {}, publish: {}, save: {}, files: {}, previews: 0, crashReports: 0 },
    siteCheck: { must: {}, should: {}, tip: {} },
    aiApps: { apps: {}, tools: {}, outcomes: {} },
    assistant: { messages: {}, tools: {}, toolStates: {} },
    timings: { startup: [], openSite: [], export: [], preview: [] },
  };
  change(data);
  return data;
}

/** A report as Save Report… writes it: the summary and the newest crash reports. */
const saved = (name: string, data: UsageSummaryData): ReceivedReport => ({
  name,
  text: `${JSON.stringify({ summary: data, crashReports: [] }, null, 2)}\n`,
});

/** Three installs: one that publishes, one that stops in Start a Site, and one that crashes. */
const FIXTURES: readonly ReceivedReport[] = [
  saved(
    "a-first.json",
    summary(A, 100, (data) => {
      data.sites.started = { template: 1 };
    }),
  ),
  saved(
    "a-later.json",
    summary(A, 200, (data) => {
      data.sites.started = { template: 2 };
      data.sites.firstEdits = 1;
      data.sites.siteChecks = 1;
      data.sites.previews = 3;
      data.sites.exports = 1;
      data.sites.published = { netlify: 1 };
      data.used.added = { Hero: 2 };
      data.tour = { taken: 1, declined: 0, finished: 0, closedAt: [0, 1] };
      data.timings.startup = [
        { at: 1, ms: 1_200 },
        { at: 2, ms: 4_000 },
      ];
      data.timings.export = [{ at: 3, ms: 2_500, pages: 5 }];
    }),
  ),
  // A summary on its own, as the file beside the crash reports holds it, is read too.
  {
    name: "b.json",
    text: JSON.stringify(
      summary(B, 150, (data) => {
        data.quickStart.cancelled = { look: 1 };
        data.timings.startup = [{ at: 1, ms: 2_000 }];
      }),
    ),
  },
  saved(
    "c.json",
    summary(C, 120, (data) => {
      data.sites.started = { blank: 1 };
      data.sites.previews = 1;
      data.failures.crashReports = 2;
      data.failures.export = { "write-failed": 1 };
      data.assistant.messages = { sending: 4 };
      data.aiApps.outcomes = { done: 3, invalid: 1 };
    }),
  ),
  { name: "notes.txt", text: "Thanks for the beta!" },
  {
    name: "tampered.json",
    text: JSON.stringify({
      summary: { ...summary(C, 999), sites: { ...summary(C, 999).sites, exports: -1 } },
    }),
  },
];

describe("the beta's reports added up (5.42, BD-3)", () => {
  it("counts each install once, by its newest report, and names each report it refuses", () => {
    const read = readReports(FIXTURES, LISTS);

    expect(read.summaries.map((each) => [each.installId, each.saved])).toEqual([
      [A, 200],
      [B, 150],
      [C, 120],
    ]);
    expect(read.older).toBe(1);
    // Neither is counted: not JSON, and a count the schema doesn't allow (from install C, whose
    // real report still counts).
    expect(read.refused).toEqual([
      { name: "notes.txt", reason: "not JSON" },
      { name: "tampered.json", reason: expect.stringMatching(/^sites\.exports: /) },
    ]);
  });

  it("keeps an install's newest report whichever order they come in", () => {
    const [first, later] = FIXTURES;
    if (first === undefined || later === undefined) throw new Error("no fixtures");
    expect(readReports([later, first], LISTS).summaries[0]?.saved).toBe(200);
  });

  it("totals note 22's five questions", () => {
    const read = readReports(FIXTURES, LISTS);
    const totals = reportTotals(read.summaries, LISTS);

    // 1. Do people finish?
    expect(totals.installs).toBe(3);
    expect(totals.finish).toEqual({
      started: 2,
      edited: 1,
      previewed: 2,
      exported: 1,
      published: 1,
    });
    expect(totals.starts).toEqual({ template: 2, blank: 1 });
    // 2. Where do they stop?
    expect(totals.stop.quickStartCancelled).toEqual({ look: 1 });
    expect(totals.stop.tour).toEqual({ taken: 1, declined: 0, finished: 0, closedAt: [0, 1] });
    expect(totals.stop.publishedTo).toEqual({ netlify: 1 });
    // 3. What breaks?
    expect(totals.breaks.crashReports).toBe(2);
    expect(totals.breaks.crashInstalls).toBe(1);
    expect(totals.breaks.export).toEqual({ "write-failed": 1 });
    expect(totals.breaks.assistant).toEqual({});
    expect(totals.breaks.aiApps).toEqual({ invalid: 1 });
    // 4. What goes unused?
    expect(totals.unused.siteCheck).toBe(1);
    expect(totals.unused.assistant).toBe(1);
    expect(totals.unused.aiApps).toBe(0);
    expect(totals.unused.components).toEqual(["Text"]);
    expect(totals.unused.commands).toEqual(USAGE_COMMANDS);
    // 5. Is it fast enough? Three start-ups from two installs, one over its 3 s.
    expect(totals.timings.startup).toEqual({
      samples: 3,
      installs: 2,
      medianMs: 2_000,
      p90Ms: 4_000,
      budgetMs: TIMING_BUDGETS_MS.startup,
      overBudget: 1,
    });
    expect(totals.timings.preview.samples).toBe(0);
  });

  it("prints the totals under each question, with the refused reports named", () => {
    const read = readReports(FIXTURES, LISTS);
    const text = formatTotals(read, reportTotals(read.summaries, LISTS));

    expect(text).toContain(
      "Reports: 3 installs, 1 older reports from the same installs left out, 2 refused",
    );
    expect(text).toContain("  Refused notes.txt: not JSON");
    expect(text).toContain("  Published:        1 of 3 (33%)");
    expect(text).toContain("  Start a Site cancelled at: look 1");
    expect(text).toContain("  Tour closed at step: 2 1");
    expect(text).toContain("  Crash reports: 2, from 1 of 3 (33%) installs");
    expect(text).toContain("  Sections and elements no install added: Text");
    expect(text).toContain(
      "  startup: 3 samples from 2 installs, median 2000 ms, 90% within 4000 ms; budget 3000 ms, 1 of 3 (33%) over",
    );
    for (const question of [1, 2, 3, 4, 5]) expect(text).toContain(`\n${question}. `);
  });

  it("totals nothing from no reports, without dividing by none", () => {
    const totals = reportTotals([], LISTS);
    const text = formatTotals({ summaries: [], refused: [], older: 0 }, totals);
    expect(text).toContain("Reports: 0 installs\n");
    expect(text).toContain("  Published:        0 of 0");
    expect(totals.timings.export.medianMs).toBe(0);
    expect(text).toContain("  export: no samples; budget 5000 ms");
  });
});
