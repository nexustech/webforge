import {
  DIAGNOSTIC_COUNTS,
  DIAGNOSTIC_TIMINGS,
  type DiagnosticCount,
} from "../shared/diagnostic-counts.js";
import type { Diagnostics } from "../shared/diagnostics.js";
import type { UsageSummaryData } from "./usage-summary.js";

/**
 * Help › Diagnostics… in main (5.41, BD-2): the usage summary flattened for the window to put in
 * words, and the one file Save Report… writes. Loaded when first used, never with main at start-up
 * (#892). Nothing is sent: the person attaches the file to their report.
 */

/** How many of the newest crash reports Save Report… puts in the file. */
export const CRASH_REPORTS_SAVED = 5;

/** A count of the summary's: a number of its own, or counts by listed name, or by position. */
type Counted = number | Partial<Record<string, number>> | readonly number[];

/** `summary`'s count at `field` (`sites.started`), as the summary holds it. */
function countAt(summary: UsageSummaryData, field: DiagnosticCount): Counted {
  const [section, name] = field.split(".") as [keyof UsageSummaryData, string];
  return (summary[section] as unknown as Readonly<Record<string, Counted>>)[name] ?? 0;
}

/** The middle of `values`, rounded: 0 for none. */
function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return 0;
  const value =
    sorted.length % 2 === 1
      ? (sorted[middle] ?? 0)
      : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  return Math.round(value);
}

/**
 * `summary` flattened for the Diagnostics window: every count by its field, those by name each
 * with its name, the tour's closes by the step's number, and each timing as its number of samples
 * and their median. Every count the summary holds is in {@link DIAGNOSTIC_COUNTS}.
 */
export function flattenSummary(summary: UsageSummaryData): Diagnostics {
  const counts: Diagnostics["counts"] = [];
  for (const field of DIAGNOSTIC_COUNTS) {
    const counted = countAt(summary, field);
    if (typeof counted === "number") {
      counts.push({ field, count: counted });
    } else if (Array.isArray(counted)) {
      // By position: the tour's steps, numbered from 1 as the person saw them.
      counted.forEach((count, index) => {
        if (count > 0) counts.push({ field, name: String(index + 1), count });
      });
    } else {
      for (const [name, count] of Object.entries(counted as Partial<Record<string, number>>)) {
        if (count !== undefined && count > 0) counts.push({ field, name, count });
      }
    }
  }
  const { computer } = summary;
  return {
    installId: summary.installId,
    since: summary.since,
    computer:
      computer === undefined
        ? null
        : {
            ...computer,
            version: computer.version.join("."),
            osVersion: computer.osVersion.join("."),
          },
    counts,
    timings: DIAGNOSTIC_TIMINGS.map((field) => {
      const samples = summary.timings[field];
      return {
        field,
        samples: samples.length,
        medianMs: median(samples.map(({ ms }) => ms)),
      };
    }),
  };
}

/**
 * The one file Save Report… writes (BD-2): the summary as it is kept, and the newest crash reports
 * as they were written, which hold nothing of any site either (F-SITE-7). Nothing else: no file
 * path, no name of the person or their computer.
 */
export function diagnosticsReport(
  summary: UsageSummaryData,
  crashReports: readonly { readonly name: string; readonly report: unknown }[],
): string {
  return `${JSON.stringify({ summary, crashReports }, null, 2)}\n`;
}
