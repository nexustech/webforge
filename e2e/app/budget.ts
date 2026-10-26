import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type TestInfo, test } from "@playwright/test";

// Time budgets under load (ADR 0014, #446, #489). A budget from the spec ("a site opens in under
// 3 s", F-SITE-1) is a wall-clock limit, and a machine running other work beside the tests (another
// worktree's checks, an install) can push one run past it. So:
// - waits are generous ({@link OPEN_WAIT}): a slow run fails on its budget, never on a wait;
// - a test with a budget may run once more, and only after a missed budget (`budgetTest`). Any
//   other failure is not retried, and a retry measures the whole operation again.

/** How long a test waits for what a timed operation shows: far past any budget it checks. */
export const OPEN_WAIT = 30_000;

/**
 * How long a test waits for work the system does in its own time, such as Windows' spell checker
 * looking at a typed word (#446): a wait with no budget, slower when the machine is busy.
 */
export const BACKGROUND_WAIT = 45_000;

/** The folder where a missed budget leaves a note for the test's one retry. */
const MISSES = join(tmpdir(), "webforge-e2e-budget-misses");

/** The note a missed budget leaves for `info`'s test, one per test. */
const missNote = (info: TestInfo) => join(MISSES, info.testId.replace(/[^A-Za-z0-9_-]/g, "_"));

/**
 * Declares the tests of the enclosing file or `describe` as checking a time budget: each may run
 * once more, but only when its first run missed the budget (see {@link expectWithinBudget}); a
 * retry after any other failure fails at once.
 */
export function budgetTests(): void {
  test.describe.configure({ retries: 1 });
  test.beforeEach(() => {
    const info = test.info();
    const note = missNote(info);
    if (info.retry === 0) {
      rmSync(note, { force: true });
      return;
    }
    if (!existsSync(note)) {
      throw new Error(
        "Only a missed time budget is retried (ADR 0014): this run failed otherwise.",
      );
    }
    rmSync(note, { force: true });
  });
}

/**
 * Checks that `startedAt` (from `Date.now()`) was at most `budgetMs` ago. A miss is recorded on the
 * test (shown in the report) and noted, so a test declared with {@link budgetTests} runs once more.
 */
export function expectWithinBudget(startedAt: number, budgetMs: number, what: string): void {
  const took = Date.now() - startedAt;
  const info = test.info();
  info.annotations.push({ type: "budget", description: `${what}: ${took} ms of ${budgetMs} ms` });
  if (took <= budgetMs) return;
  mkdirSync(MISSES, { recursive: true });
  writeFileSync(missNote(info), `${what}: ${took} ms`);
  throw new Error(`${what} took ${took} ms, over its ${budgetMs} ms budget`);
}
