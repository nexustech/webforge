import type { CheckLevel, CheckReport } from "@webforge/site-check";

/** Site Check's levels, most pressing first. */
export const LEVELS: readonly CheckLevel[] = ["must", "should", "tip"];

/**
 * How many findings a check found at each level, ignored ones left out: what the panel's summary
 * and the title bar's button both count (#1009), so they always agree.
 */
export function countsByLevel(report: CheckReport): Readonly<Record<CheckLevel, number>> {
  const counts: Record<CheckLevel, number> = { must: 0, should: 0, tip: 0 };
  for (const result of report.results) counts[result.level] += result.findings.length;
  return counts;
}
