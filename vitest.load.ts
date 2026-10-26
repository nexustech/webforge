import { availableParallelism } from "node:os";

// Test timeouts under load (ADR 0014, #446): a test's timeout is a limit on how long it may take,
// set for CI's runners, where `pnpm test` runs 2 workers (4 vCPUs, `maxWorkers: "50%"`). On a
// machine with more threads the run has more workers, which share its CPU with each other (and
// with whatever else it runs), so each test may take as much longer as there are more of them.

/** How many workers a run has: half the CPU threads, as `vitest.config.ts` sets. */
const WORKERS = Math.max(1, Math.floor(availableParallelism() / 2));

/** How much longer than on CI a test may take in this run: never less. */
export const TIMEOUT_SCALE = Math.max(1, WORKERS / 2);

/** A timeout set for CI, for this run. */
export const scaledTimeout = (ms: number): number => Math.round(ms * TIMEOUT_SCALE);
