import type { CreateProjectStep } from "@webforge/storage";

/**
 * How long each step of opening a site takes, for the E2E tests (#1560): an opening once waited
 * about 5.8 s without working, and a miss of its budget names its steps instead of failing
 * silent. Off unless the E2E launch sets `WEBFORGE_STEP_TIMINGS=1`, read once as main starts: the
 * packaged app never records anything.
 *
 * Durations only, under names fixed here: never a site's name, a path, a template's content or
 * anything a person wrote (CLAUDE.md, never log site content). Nothing is written to the log; the
 * tests read the steps from main with `app.evaluate`.
 */

/** The steps, by name. Images are numbered, never named: an image's name is the site's content. */
export type StepName =
  | CreateProjectStep
  | `image ${number} of ${number}`
  | "save the site"
  | "open the session"
  | "a frame finished loading";

/**
 * A step: its name, how long it took (on the monotonic clock, which a test faking `Date` leaves
 * alone) and when it ended, in ms since 1970, to set beside a test's own clock.
 */
export type TimedStep = { readonly step: StepName; readonly ms: number; readonly at: number };

/** Whether the E2E launch asked for the steps' times. */
const ON = process.env.WEBFORGE_STEP_TIMINGS === "1";

/** Whether the steps are recorded: for what is only set up to record them. */
export const STEP_TIMINGS_ON = ON;

/** The most steps kept: the latest, so a long session's list never grows without end. */
const MAX_STEPS = 500;

const steps: TimedStep[] = [];

function record(step: StepName, start: number): void {
  steps.push({ step, ms: Math.round(performance.now() - start), at: Date.now() });
  if (steps.length > MAX_STEPS) steps.splice(0, steps.length - MAX_STEPS);
}

/** Runs `run` as `step`, timed when the steps are recorded; the step ends even if `run` throws. */
export function timeStep<T>(step: StepName, run: () => T): T {
  if (!ON) return run();
  const start = performance.now();
  try {
    return run();
  } finally {
    record(step, start);
  }
}

/** {@link timeStep} for a step that finishes later. */
export async function timeStepLater<T>(step: StepName, run: () => Promise<T>): Promise<T> {
  if (!ON) return run();
  const start = performance.now();
  try {
    return await run();
  } finally {
    record(step, start);
  }
}

/** Notes that `step` happened now, taking no time of its own: a frame that finished loading. */
export function markStep(step: StepName): void {
  if (ON) record(step, performance.now());
}

/** The steps recorded so far, oldest first; none when they aren't recorded. */
export function recordedSteps(): readonly TimedStep[] {
  return steps.slice();
}

// For the E2E tests, which read the steps from main (`app.evaluate`), with no IPC of their own.
if (ON) Object.assign(globalThis, { webforgeStepTimings: recordedSteps });
