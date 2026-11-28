import type { ElectronApplication } from "@playwright/test";

/** A step main timed (`step-timings.ts`, #1560): durations under fixed names only. */
export type TimedStep = { readonly step: string; readonly ms: number; readonly at: number };

/**
 * The steps main timed after `since` (#1560): each one's time and when it ended, in ms after
 * `since`, so the time no step accounts for shows between them. For an opening's miss, in
 * `templates.spec.ts` and the openings' budget (#1621).
 */
export async function stepsSince(app: ElectronApplication, since: number): Promise<string> {
  // A main that's stuck or gone can't say: the failure being explained still comes through.
  const steps = await app
    .evaluate(
      () =>
        (
          globalThis as { webforgeStepTimings?: () => readonly TimedStep[] }
        ).webforgeStepTimings?.() ?? [],
    )
    .catch(() => undefined);
  if (steps === undefined) return "Main's steps couldn't be read.";
  const after = steps.filter((each) => each.at >= since);
  return after.length === 0
    ? "Main timed no steps after Create."
    : `Each step after Create, its ms (and when it ended, after Create): ${after
        .map((each) => `${each.step} ${each.ms} (+${each.at - since})`)
        .join(", ")}`;
}
