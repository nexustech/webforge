import { type UsageLists, type UsageSummaryData } from "./usage-summary.js";
/** A report as received: Save Report…'s file (`{ summary, crashReports }`), or a summary alone. */
export type ReceivedReport = {
  readonly name: string;
  readonly text: string;
};
/** The reports read: one summary per install, the newest, and those left out. */
export type ReadReports = {
  readonly summaries: readonly UsageSummaryData[];
  /** Reports that aren't a usage summary this build reads, by name, with why: never counted. */
  readonly refused: readonly {
    readonly name: string;
    readonly reason: string;
  }[];
  /** Older reports from an install that sent a newer one: counted once, as the newest. */
  readonly older: number;
};
/**
 * Reads `reports` against the usage summary's schema with `lists`' names (BD-1): one that isn't
 * JSON or fails the schema is refused, never counted; of an install's reports, by its random
 * number (BD-5), only the newest is kept, so a tester who sends two counts once.
 */
export declare function readReports(
  reports: readonly ReceivedReport[],
  lists: UsageLists,
): ReadReports;
/** Counts by name, added up across summaries. */
type Counts = Readonly<Record<string, number>>;
/** One timing across installs: its samples against architecture §10's budget. */
export type TimingTotals = {
  readonly samples: number;
  readonly installs: number;
  readonly medianMs: number;
  /** The time nine samples in ten were within. */
  readonly p90Ms: number;
  readonly budgetMs: number;
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
export declare const TIMING_BUDGETS_MS: Readonly<Record<keyof UsageSummaryData["timings"], number>>;
/**
 * The totals of `summaries`, one per install (see {@link readReports}), for note 22 §2's five
 * questions; `lists` names the sections and elements, so the ones never added can be listed.
 */
export declare function reportTotals(
  summaries: readonly UsageSummaryData[],
  lists: Pick<UsageLists, "components">,
): ReportTotals;
/** `read` and its totals as the script prints them: plain text, a heading per question. */
export declare function formatTotals(read: ReadReports, totals: ReportTotals): string;
//# sourceMappingURL=report-totals.d.ts.map
