# 0014. Time budgets and waits in tests, on a busy machine

- Status: Accepted
- Date: 2026-10-27
- Related: #446, #489, [standards §5](../../spec/03-engineering-standards.md#test-conventions), [ADR 0013](0013-store-gate.md) (R13, R15)

## Context
Tests check time in three ways, and all three failed when the machine ran other work beside them (another worktree's checks, an install, three streams at once), on `main` as well as on branches:
- **Budgets from the spec.** "A site opens in under 3 s" (F-SITE-1) is checked from the Create click to the hero on the canvas, in `templates.spec.ts` and `start-screen.spec.ts`. Locally they took 3.0–5.1 s under load and passed alone (#489).
- **Waits.** Playwright's 5 s `expect` timeout ran out before a template's heading showed on CI's Windows runner, and the spell checker's 15 s poll ran out on a busy machine (#446).
- **Unit test timeouts.** Under `pnpm check`, the App, edit-panel and store-gate tests went past their timeouts (#446). The store-gate property test waited on real timers, 60 runs of up to 12 works.

Re-running a failed job hides all three, and each makes the next failure harder to read.

## Decision
1. **Measure the operation itself where a clock isn't the point.**
   - ADR 0013 measures the main thread's CPU time, not wall time, and R15 checks that nothing is read or encoded. A test like these doesn't slow down with the machine.
   - The store-gate property test now holds each piece of work for a few turns of the microtask queue rather than 0–3 ms of real time. It checks the gate's order and exclusion with no clock in it.
2. **A budget from the spec stays a wall-clock budget, with one retry after a miss** (`e2e/app/budget.ts`).
   - A test that checks one declares it with `budgetTests()`, and checks it with `expectWithinBudget(started, 3_000, what)`. The time taken goes in the report every time.
   - A miss fails the run and leaves a note, and the test runs once more from the start, so the whole operation is measured again.
   - A retry finds no note when the first run failed any other way, and fails at once. So nothing but a missed budget is ever retried.
3. **Waits are generous, so a slow run fails on its budget, never on a wait.**
   - What a timed operation shows is waited for up to `OPEN_WAIT` (30 s).
   - Work the system does in its own time, such as the spell checker, is waited for up to `BACKGROUND_WAIT` (45 s), in tests marked `test.slow()`.
4. **Unit test timeouts scale to the run's workers** (`vitest.load.ts`).
   - The timeouts were set for CI's runners, where `pnpm test` runs 2 workers (4 vCPUs, `maxWorkers: "50%"`). A run with more workers gives each test as much more time: `workers / 2`, never less than 1. So on CI they are as they were, and on a 12-thread machine (6 workers) three times as long.
   - The renderer's and editor-ui's default is 15 s, scaled. A test that sets a longer one scales it with `scaledTestTimeout()` (`@webforge/test-utils/renderer`).

## Consequences
- **The budgets still mean what the spec says.** A site that opens in 3.5 s twice in a row fails. One that misses once under load and makes it on the second try passes, with both times in the report.
- **A real hang still fails, just later:** a wait after up to 45 s, a unit test after its scaled timeout.
- **Out of scope:** storage's 30 s and the publish tests' timeouts cover slow disks and servers, not load, and stay as they are.
- **A new check of time picks one of the three:** measure the work (best), a budget with `budgetTests()` and `expectWithinBudget()`, or a generous wait. A bare `expect(Date.now() - started).toBeLessThan(…)` is the mistake this replaces.
