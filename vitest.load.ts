import { availableParallelism } from "node:os";

// Test timeouts under load (ADR 0014, #446): a test's timeout is a limit on how long it may take,
// set for CI's runners, where `pnpm test` runs 2 workers (4 vCPUs, `maxWorkers: "50%"`). On a
// machine with more threads the run has more workers, which share its CPU with each other (and
// with whatever else it runs), so each test may take as much longer as there are more of them.

/** How many workers a run has: half the CPU threads. `vitest.config.ts` runs this many. */
export const WORKERS = Math.max(1, Math.floor(availableParallelism() / 2));

/** How much longer than on CI a test may take in this run: never less. */
export const TIMEOUT_SCALE = Math.max(1, WORKERS / 2);

/** A timeout set for CI, for this run. */
export const scaledTimeout = (ms: number): number => Math.round(ms * TIMEOUT_SCALE);

/**
 * Site Check's cost test (ADR 0016), from `packages/site-check`. It times the rules against a copy
 * of the site through JSON. Coverage counts every block of the rules' JavaScript as it runs, but
 * not the native JSON copy, so under coverage the rules read as up to twice as costly (#698). So
 * `pnpm test` leaves it out, and `pnpm test:compiled`, which runs without coverage, runs it.
 */
export const SITE_CHECK_COST_TEST = "src/check-cost.test.ts";
