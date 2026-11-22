import { USAGE_COMMANDS } from "../shared/usage.js";
import { type UsageLists, type UsageSummaryData, usageSummarySchema } from "./usage-summary.js";

// The beta's reports added up (5.42, BD-3, research/product/22 §2): the usage summaries testers
// attach to their issues, each checked against BD-1's schema, each install counted once, and the
// totals for the note's five questions. `report-totals-cli.ts` runs it on a folder of reports
// (`pnpm report-totals <folder>`); the triage notes say when.

/** A report as received: Save Report…'s file (`{ summary, crashReports }`), or a summary alone. */
export type ReceivedReport = { readonly name: string; readonly text: string };

/** The reports read: one summary per install, the newest, and those left out. */
export type ReadReports = {
  readonly summaries: readonly UsageSummaryData[];
  /** Reports that aren't a usage summary this build reads, by name, with why: never counted. */
  readonly refused: readonly { readonly name: string; readonly reason: string }[];
  /** Older reports from an install that sent a newer one: counted once, as the newest. */
  readonly older: number;
};

/** Why `issues`' first problem refused a report, where it is: `sites.exports: Too small`. */
function reasonOf(issues: readonly { readonly path: readonly PropertyKey[]; message: string }[]) {
  const [first] = issues;
  if (first === undefined) return "not a usage summary";
  const where = first.path.map(String).join(".");
  return where === "" ? first.message : `${where}: ${first.message}`;
}

/**
 * Reads `reports` against the usage summary's schema with `lists`' names (BD-1): one that isn't
 * JSON or fails the schema is refused, never counted; of an install's reports, by its random
 * number (BD-5), only the newest is kept, so a tester who sends two counts once.
 */
export function readReports(reports: readonly ReceivedReport[], lists: UsageLists): ReadReports {
  const schema = usageSummarySchema(lists);
  const newest = new Map<string, UsageSummaryData>();
  const refused: { name: string; reason: string }[] = [];
  let older = 0;
  for (const { name, text } of reports) {
    let data: unknown;
    try {
      // A report re-saved by an editor such as Notepad may start with a byte order mark.
      data = JSON.parse(text.replace(/^\uFEFF/, ""));
    } catch {
      refused.push({ name, reason: "not JSON" });
      continue;
    }
    const summary =
      typeof data === "object" && data !== null && "summary" in data ? data.summary : data;
    const parsed = schema.safeParse(summary);
    if (!parsed.success) {
      refused.push({ name, reason: reasonOf(parsed.error.issues) });
      continue;
    }
    const kept = newest.get(parsed.data.installId);
    if (kept !== undefined) older++;
    if (kept === undefined || parsed.data.saved > kept.saved) {
      newest.set(parsed.data.installId, parsed.data);
    }
  }
  return { summaries: [...newest.values()], refused, older };
}

/** Counts by name, as the summary holds them: only those counted. */
type Counts = Readonly<Partial<Record<string, number>>>;

/** One timing across installs: its samples against architecture §10's budget. */
type TimingTotals = {
  readonly samples: number;
  readonly installs: number;
  readonly medianMs: number;
  /** The time nine samples in ten were within. */
  readonly p90Ms: number;
  readonly budgetMs: number;
  /** The most pages a sample is held to the budget for; none for a timing of any size. */
  readonly budgetPages?: number;
  /** Samples held to the budget: those of a site no larger than its pages, or every one. */
  readonly measured: number;
  readonly overBudget: number;
};

/** The totals for note 22 §2's five questions. */
export type ReportTotals = {
  readonly installs: number;
  /** 1. Do people finish? Installs that started a site, previewed, exported and published. */
  readonly finish: {
    readonly started: number;
    readonly edited: number;
    readonly previewed: number;
    readonly exported: number;
    readonly published: number;
  };
  readonly starts: Counts;
  /** 2. Where do they stop? Start a Site's steps, the tour, and publishing's hosts. */
  readonly stop: {
    readonly quickStartCreated: Counts;
    readonly quickStartCancelled: Counts;
    readonly tour: {
      readonly taken: number;
      readonly declined: number;
      readonly finished: number;
      /** Closed at each step, the first step first. */
      readonly closedAt: readonly number[];
    };
    readonly publishedTo: Counts;
  };
  /** 3. What breaks? Crash reports, and each kind of failure by its code. */
  readonly breaks: {
    readonly crashReports: number;
    readonly crashInstalls: number;
    readonly export: Counts;
    readonly publish: Counts;
    readonly save: Counts;
    readonly files: Counts;
    readonly previews: number;
    readonly assistant: Counts;
    readonly aiApps: Counts;
  };
  /** 4. What goes unused? Installs that used each part, and what no install used. */
  readonly unused: {
    readonly siteCheck: number;
    readonly aiApps: number;
    readonly assistant: number;
    readonly phonePreview: number;
    readonly commands: readonly string[];
    readonly components: readonly string[];
  };
  /** 5. Is it fast enough? Each timing against its budget. */
  readonly timings: Readonly<Record<keyof UsageSummaryData["timings"], TimingTotals>>;
};

/**
 * Architecture §10's budgets for the summary's timings, as `pnpm e2e:perf` holds them: a cold
 * start to an editable canvas and opening a site, 3 s; a 20-page export, 5 s; the preview's first
 * build, a whole site's, held to the export's.
 */
export const TIMING_BUDGETS_MS: Readonly<Record<keyof UsageSummaryData["timings"], number>> = {
  startup: 3_000,
  openSite: 3_000,
  export: 5_000,
  preview: 5_000,
};

/**
 * The largest site a budget is for, in pages, where §10 says (a 20-page export): a sample of a
 * larger site isn't held to it, since a 60-page export in 7 s is no miss. A sample that doesn't
 * say how many pages it had is held to it.
 */
const BUDGET_PAGES: Partial<Record<keyof UsageSummaryData["timings"], number>> = {
  export: 20,
  preview: 20,
};

/** `counts` added up, each name's total. */
function addUp(counts: readonly Counts[]): Record<string, number> {
  const total: Record<string, number> = {};
  for (const each of counts) {
    for (const [name, count = 0] of Object.entries(each)) total[name] = (total[name] ?? 0) + count;
  }
  return total;
}

/** The sum of a summary's counts by name. */
const sum = (counts: Counts) =>
  Object.values(counts).reduce((all: number, count = 0) => all + count, 0);

/** The value `share` of the way through `sorted` (0.5, the median), the nearest sample's. */
function percentile(sorted: readonly number[], share: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil(share * sorted.length) - 1);
  return Math.round(sorted[Math.max(0, index)] ?? 0);
}

/** One timing across `summaries`, against `budgetMs`. */
function timingTotals(
  summaries: readonly UsageSummaryData[],
  timing: keyof UsageSummaryData["timings"],
): TimingTotals {
  const budgetMs = TIMING_BUDGETS_MS[timing];
  const budgetPages = BUDGET_PAGES[timing];
  const each = summaries.map((summary) => summary.timings[timing]);
  const samples = each.flat();
  const all = samples.map(({ ms }) => ms).sort((a, b) => a - b);
  const measured = samples.filter(
    ({ pages }) => budgetPages === undefined || pages === undefined || pages <= budgetPages,
  );
  return {
    samples: all.length,
    installs: each.filter((one) => one.length > 0).length,
    medianMs: percentile(all, 0.5),
    p90Ms: percentile(all, 0.9),
    budgetMs,
    ...(budgetPages === undefined ? {} : { budgetPages }),
    measured: measured.length,
    overBudget: measured.filter(({ ms }) => ms > budgetMs).length,
  };
}

/**
 * The totals of `summaries`, one per install (see {@link readReports}), for note 22 §2's five
 * questions; `lists` names the sections and elements, so the ones never added can be listed.
 */
export function reportTotals(
  summaries: readonly UsageSummaryData[],
  lists: Pick<UsageLists, "components">,
): ReportTotals {
  const installs = (has: (summary: UsageSummaryData) => boolean) => summaries.filter(has).length;
  const commands = addUp(summaries.map((summary) => summary.used.commands));
  const added = addUp(summaries.map((summary) => summary.used.added));
  const assistant = addUp(summaries.map((summary) => summary.assistant.messages));
  const { sending: _sending, ...assistantErrors } = assistant;
  const closedAt: number[] = [];
  for (const summary of summaries) {
    summary.tour.closedAt.forEach((count, step) => {
      closedAt[step] = (closedAt[step] ?? 0) + count;
    });
  }
  return {
    installs: summaries.length,
    finish: {
      started: installs((summary) => sum(summary.sites.started) > 0),
      edited: installs((summary) => summary.sites.firstEdits > 0),
      previewed: installs((summary) => summary.sites.previews > 0),
      exported: installs((summary) => summary.sites.exports > 0),
      published: installs((summary) => sum(summary.sites.published) > 0),
    },
    starts: addUp(summaries.map((summary) => summary.sites.started)),
    stop: {
      quickStartCreated: addUp(summaries.map((summary) => summary.quickStart.created)),
      quickStartCancelled: addUp(summaries.map((summary) => summary.quickStart.cancelled)),
      tour: {
        taken: summaries.reduce((all, summary) => all + summary.tour.taken, 0),
        declined: summaries.reduce((all, summary) => all + summary.tour.declined, 0),
        finished: summaries.reduce((all, summary) => all + summary.tour.finished, 0),
        closedAt: Array.from(closedAt, (count) => count ?? 0),
      },
      publishedTo: addUp(summaries.map((summary) => summary.sites.published)),
    },
    breaks: {
      crashReports: summaries.reduce((all, summary) => all + summary.failures.crashReports, 0),
      crashInstalls: installs((summary) => summary.failures.crashReports > 0),
      export: addUp(summaries.map((summary) => summary.failures.export)),
      publish: addUp(summaries.map((summary) => summary.failures.publish)),
      save: addUp(summaries.map((summary) => summary.failures.save)),
      files: addUp(summaries.map((summary) => summary.failures.files)),
      previews: summaries.reduce((all, summary) => all + summary.failures.previews, 0),
      assistant: assistantErrors,
      aiApps: Object.fromEntries(
        Object.entries(addUp(summaries.map((summary) => summary.aiApps.outcomes))).filter(
          ([outcome]) => outcome !== "done",
        ),
      ),
    },
    unused: {
      siteCheck: installs((summary) => summary.sites.siteChecks > 0),
      aiApps: installs((summary) => sum(summary.aiApps.tools) > 0),
      assistant: installs((summary) => (summary.assistant.messages.sending ?? 0) > 0),
      phonePreview: installs((summary) => summary.sites.phonePreviews > 0),
      commands: USAGE_COMMANDS.filter((command) => (commands[command] ?? 0) === 0),
      components: lists.components.filter((type) => (added[type] ?? 0) === 0),
    },
    timings: {
      startup: timingTotals(summaries, "startup"),
      openSite: timingTotals(summaries, "openSite"),
      export: timingTotals(summaries, "export"),
      preview: timingTotals(summaries, "preview"),
    },
  };
}

/** `count` of `of`, with its share: `3 of 4 (75%)`. */
const share = (count: number, of: number) =>
  of === 0 ? `${count} of 0` : `${count} of ${of} (${Math.round((count / of) * 100)}%)`;

/** Counts by name, most first, on one line: `none` when there are none. */
function countsLine(counts: Counts): string {
  const entries = Object.entries(counts)
    .flatMap(([name, count = 0]) => (count > 0 ? [[name, count] as const] : []))
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b));
  return entries.length === 0 ? "none" : entries.map(([name, n]) => `${name} ${n}`).join(", ");
}

/** A list of names on one line: `none` when it's empty. */
const namesLine = (names: readonly string[]) => (names.length === 0 ? "none" : names.join(", "));

/** `read` and its totals as the script prints them: plain text, a heading per question. */
export function formatTotals(read: ReadReports, totals: ReportTotals): string {
  const { finish, stop, breaks, unused } = totals;
  const n = totals.installs;
  const lines = [
    `Reports: ${n} installs` +
      (read.older === 0 ? "" : `, ${read.older} older reports from the same installs left out`) +
      (read.refused.length === 0 ? "" : `, ${read.refused.length} refused`),
    ...read.refused.map(({ name, reason }) => `  Refused ${name}: ${reason}`),
    "",
    "1. Do people finish? (installs)",
    `  Started a site:   ${share(finish.started, n)}`,
    `  Edited one:       ${share(finish.edited, n)}`,
    `  Previewed:        ${share(finish.previewed, n)}`,
    `  Exported:         ${share(finish.exported, n)}`,
    `  Published:        ${share(finish.published, n)}`,
    `  Sites started, by how: ${countsLine(totals.starts)}`,
    "",
    "2. Where do they stop?",
    `  Start a Site created at:   ${countsLine(stop.quickStartCreated)}`,
    `  Start a Site cancelled at: ${countsLine(stop.quickStartCancelled)}`,
    `  Tour: taken ${stop.tour.taken}, declined ${stop.tour.declined}, finished ${stop.tour.finished}`,
    `  Tour closed at step: ${countsLine(
      Object.fromEntries(stop.tour.closedAt.map((count, step) => [String(step + 1), count])),
    )}`,
    `  Published to: ${countsLine(stop.publishedTo)}`,
    "",
    "3. What breaks?",
    `  Crash reports: ${breaks.crashReports}, from ${share(breaks.crashInstalls, n)} installs`,
    `  Exports failed: ${countsLine(breaks.export)}`,
    `  Publishes failed: ${countsLine(breaks.publish)}`,
    `  Saves failed: ${countsLine(breaks.save)}`,
    `  Files failed: ${countsLine(breaks.files)}`,
    `  Previews failed: ${breaks.previews}`,
    `  Assistant errors: ${countsLine(breaks.assistant)}`,
    `  AI app requests not done: ${countsLine(breaks.aiApps)}`,
    "",
    "4. What goes unused? (installs that used it)",
    `  Site Check:    ${share(unused.siteCheck, n)}`,
    `  Phone preview: ${share(unused.phonePreview, n)}`,
    `  AI apps:       ${share(unused.aiApps, n)}`,
    `  The Assistant: ${share(unused.assistant, n)}`,
    `  Commands no install used: ${namesLine(unused.commands)}`,
    `  Sections and elements no install added: ${namesLine(unused.components)}`,
    "",
    "5. Is it fast enough? (architecture §10's budgets)",
    ...Object.entries(totals.timings).map(([timing, t]) => {
      const budget =
        t.budgetPages === undefined
          ? `budget ${t.budgetMs} ms`
          : `budget ${t.budgetMs} ms up to ${t.budgetPages} pages`;
      if (t.samples === 0) return `  ${timing}: no samples; ${budget}`;
      const larger = t.samples - t.measured;
      return (
        `  ${timing}: ${t.samples} samples from ${t.installs} installs, median ${t.medianMs} ms, ` +
        `90% within ${t.p90Ms} ms; ${budget}, ${share(t.overBudget, t.measured)} over` +
        (larger === 0 ? "" : ` (${larger} of a larger site left out)`)
      );
    }),
  ];
  return `${lines.join("\n")}\n`;
}
