# 0014. Time in tests, on a busy machine

- Status: Accepted
- Date: 2026-10-27
- Related: #446, #489, #526, [standards §5](../../spec/03-engineering-standards.md#test-conventions), [ADR 0007](0007-large-page-performance.md), [ADR 0013](0013-store-gate.md) (R13, R15)

## Context
Tests checked time in three ways, and all three failed when the machine ran other work beside them (another worktree's checks, an install, three streams at once), on `main` as well as on branches. On CI, #489 failed an unrelated PR's merge on the Windows runner.
- **Budgets from the spec.** "A site opens in under 3 s" (spec/02, F-SITE-1) was checked in every run as wall time, from the Create click to the hero on the canvas (`templates.spec.ts`, `start-screen.spec.ts`).
  - Under load it took 3.0–5.1 s.
  - With nothing else of ours running, on a machine other sessions keep near 50% busy, the Café template still took 2.8–3.1 s.
  - The work it does was steady all the while: 6.5–6.9 CPU-seconds across Webforge's processes, within about 5%.
- **Waits.** Playwright's 5 s `expect` timeout ran out before a template's heading showed on CI's Windows runner, and the spell checker's 15 s poll ran out on a busy machine (#446).
- **Unit test timeouts.** Under `pnpm check`, the App, edit-panel and store-gate tests went past their timeouts (#446). The store-gate property test waited on real timers: 60 runs of up to 12 works.

Re-running a failed job hides all three, and each makes the next failure harder to read.

## Decision
1. **Measure the work where a clock isn't the point.**
   - ADR 0013 measures the main thread's CPU time, and R15 checks that nothing is read or encoded. Neither slows down with the machine.
   - The store-gate property test holds each piece of work for a few turns of the microtask queue rather than 0–3 ms of real time. It checks the gate's order and exclusion with no clock in it.
2. **Opening a site is checked in every run by its CPU time, with a loose wall-clock backstop** (`e2e/app/budget.ts`).
   - **What is measured:** `measureWork(app)` takes each process's `cumulativeCPUUsage` (Electron's `app.getAppMetrics()`) just before Create, and again once the hero shows. A process that starts in between, such as the export worker, counts from 0. One that exits in between is lost, so the count can only come out low.
   - **The check:** `expectWorkWithin(work, OPEN_BUDGET, what)` checks the CPU budget, then the backstop, and prints both in the report and the log.
   - **The CPU budget** is about 30% over the most CI's runners measured for any opening, per platform. CPU-seconds scale with clock speed, and the runners differ.
     - **CI** (`CI=true`): Linux 4.4, Windows 5.4, macOS 4.6 CPU-s (#526, 27 Oct 2026). They're set from every E2E job of 26 and 27 Oct, on `main` and on PRs, every attempt included: 31 runs per platform, about 300 openings each (six templates, a template from the start screen, Personal / CV and the example).

       | Platform | Openings | CPU-s: least, median, most | Wall: median, slowest |
       |---|---|---|---|
       | Linux | 306 | 1.34, 2.34, 3.34 | 1.0 s, 1.6 s |
       | Windows | 297 | 1.64, 2.53, 4.16 | 1.4 s, 7.8 s |
       | macOS | 315 | 1.15, 1.92, 3.51 | 1.0 s, 2.6 s |

     - **The budgets are the most plus 30%.** The first budgets came from two runs (27 Oct: Linux 1.75–3.31, Windows 1.64–2.85, macOS 1.36–3.26) and failed three unrelated PRs on Windows the same day (#522 at 3.92 CPU-s, #538 at 4.00–4.16, and #520's 7.8 s wall).
     - **What a job costs depends on the runner it gets, not on the day's changes.** The Windows jobs' median openings stayed within 1.9–2.9 CPU-s from the first run to the last, before and after the Appearance group, the text marks, the hover row, section backgrounds and Site Check merged, with two exceptions.
       - Those two jobs had the costliest openings, all nine of them dearer: #522's (median 2.98, most 3.92) and #538's second attempt (median 3.29, most 4.16).
       - #538's third attempt, the same commit, cost a median 2.74, most 3.04.
       - GitHub's runners don't all have the same processors, so the same work costs a different number of CPU-seconds from job to job.
     - **A slow runner gets a larger budget** (#677, 31 Oct 2026). On one macOS job all nine openings cost 5.5–7.5 CPU-s, over the 4.6 budget, with nothing changed.
       - So each worker times a fixed piece of work in Webforge's main process once its first opening is measured (`calibrate`: reading and writing a JSON document of 20,000 records 40 times, the quickest of three tries).
       - A runner slower at it than CI's usual ones (`CI_CALIBRATION_SECONDS`) gets a CPU budget that much larger, at most twice; a faster one keeps CI's. Each `[work]` line shows the factor and the calibration.
       - Opening costs follow it: of two Linux runners, the one at 0.178 CPU-s took 27% more CPU to open each template than the one at 0.125.
       - An opening three times costlier still fails on a slow runner, since its cost grows as its budget does: the budgets are about twice a usual opening.
     - **Locally:** three times CI's, or `WEBFORGE_E2E_CPU_SCALE` times. A development machine cost 2–3 times as much: 5.3–7.8 CPU-s on Windows. Its canvas is drawn on a larger, high-DPI screen (more pixels to raster and composite), and it shares its CPU with other work, whose switching costs our processes CPU time too.
     - **A miss** says which budget applied, CI's or the local one, with what was measured.
   - **The backstop** (`CI_OPEN_WALL_BACKSTOP_MS`) catches what costs time but no CPU: an added timer, a lost event, IPC round trips in series. On CI it is at least twice the slowest opening measured, and never under 6 s, twice the target:
     - Linux and macOS: 6 s (slowest 1.6 and 2.6 s);
     - Windows: 30 s, which is `OPEN_WAIT`, so on Windows it catches a hang only, and the median of a spec's openings a wait added to each (see Consequences). Windows' runners stall now and then without spending more CPU:
       - #515's 6.6 s and #520's 7.8 s openings cost 2.1 and 2.7 CPU-s, well within the CPU budget, and the first backstop of 16 s allowed for them.
       - On 28 Oct 2026 a Café opening took 21.5 s at 2.26 CPU-s (#561). In the same hour, the unit test that makes the same site without Electron took 18.3 s, where it takes 0.3–1.8 s.
       - Twice that is past `OPEN_WAIT`. An added wait still fails on Linux and macOS, which run the same code.
       - **Making a site from a template didn't get slower** (#561). Across every Windows E2E job of 26–28 Oct, the Café opening's median was 1.38 s and 2.54 CPU-s before 2.29's templates merged (48 openings), and 1.35 s and 2.43 CPU-s after (21). The unit test's median was 0.57 s before and 0.55 s after (95 runs).
     - Locally it is 12 s, or CI's for the platform if more: openings took up to 8.4 s on a development machine under load.
   - **If a platform's Electron gives no `cumulativeCPUUsage`** (it is optional in Electron's types), the test fails and says so. It never skips.
   - **Nothing is retried.**
3. **The 3 s is the product's target, checked where it means something:** `pnpm e2e:perf` (ADR 0007) opens each template on a quiet machine and checks each against 3 s, keeping the times in `e2e/perf-results/open-site.json`.
4. **Waits are generous, so a slow run fails on its budget, never on a wait.**
   - What a timed operation shows is waited for up to `OPEN_WAIT` (30 s).
   - Work the system does in its own time, such as the spell checker, is waited for up to `BACKGROUND_WAIT` (45 s), in tests marked `test.slow()`.
   - Closing with nothing to save was timed against the save request's 5 s timeout. Under load, closing can also wait on the store gate (ADR 0013), behind a backup on a busy disk, and took 6–13 s with the request answered at once. The unit tests check that the start screen answers and that the window closes on the answer, so the E2E test no longer times the close.
5. **Unit test timeouts scale to the run's workers** (`vitest.load.ts`).
   - They were set for CI's runners, where `pnpm test` runs 2 workers (4 vCPUs, `maxWorkers: "50%"`). A run with more workers gives each test as much more time: `workers / 2`, never less than 1. So CI's timeouts are as they were, and on a 12-thread machine (6 workers) they are three times as long.
   - **Where it applies:** the packages whose tests timed out under `pnpm check`, each in its own `vitest.config.ts`. The renderer's and editor-ui's default is 15 s, scaled. The pipeline's and tools' take Vitest's defaults (5 s, hooks 10 s), scaled: they run Tailwind and the compilers.
   - **Not everywhere:** a package without a config of its own keeps Vitest's unscaled defaults. Vitest won't run an inline project beside directory projects with different `maxWorkers`, so the root config can't set them. Such a package gets a `vitest.config.ts` if its tests start timing out.
   - **A test that sets a longer timeout** scales it with `scaledTestTimeout()` (`@webforge/test-utils/renderer`).

## Consequences
- **Every run catches the opening doing more work, or waiting longer,** whatever else the machine runs. Whether it opens in 3 s is a question for a quiet machine: answer it with `pnpm e2e:perf` before a release, and after work that touches opening a site.
- **The CPU budget follows CI's runners.** If a platform's runners get much slower or faster, re-measure from the `[work]` lines of every E2E job over a day or two, every attempt included (a re-run job's first attempt is only in `actions/runs/<id>/attempts/<n>/jobs`), and set its budget again at the most plus 30%, and `CI_CALIBRATION_SECONDS` at the calibrations' median. One or two runs aren't enough (#526). A developer whose machine needs more than three times CI's sets `WEBFORGE_E2E_CPU_SCALE`.
- **A real hang still fails, just later:** a wait after up to 45 s, a unit test after its scaled timeout.
- **On Windows, each opening's wall time is checked for hangs only** (#561), so a wait in a Windows-only branch of the open path (a retry with a delay after `EBUSY`, say) gets past it: Linux and macOS never run that branch.
  - **The median of templates.spec's openings catches it instead** (#569, `expectMedianWithin` in its `afterAll`).
  - On CI the median may take 6 s (`CI_OPEN_MEDIAN_MS`), twice the 3 s target as Linux's and macOS's backstops. Locally it is the local backstop.
  - One stall doesn't move a median. Windows' usual median was 1.36 s, and its slowest 3.85 s, in a job whose every opening was slow (69 jobs, 26–28 Oct 2026).
  - It catches a wait of about 5 s added to every opening. A shorter one still needs code review.
- **Out of scope:** storage's 30 s and the publish tests' timeouts cover slow disks and servers, not load, and stay as they are.
- **A new check of time picks one of these:** measure the work (best), a CPU budget with a wall-clock backstop, a unit test of the logic a time stood in for, or a generous wait. A bare `expect(Date.now() - started).toBeLessThan(…)` with a target from the spec is what this replaces.
