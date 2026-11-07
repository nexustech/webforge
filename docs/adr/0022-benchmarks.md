# 0022. Benchmarks: compared with `main` in one CI job

- Status: Accepted
- Date: 2026-11-07
- Related: [spec/04 item 5.1](../../spec/04-implementation-plan.md) (#76), [architecture §10](../../spec/01-architecture.md#10-performance-targets), [engineering standards §5](../../spec/03-engineering-standards.md#5-testing-strategy), [ADR 0007](0007-large-page-performance.md)

## Context
The standards ask for `vitest bench` benchmarks in `bench/`, with CI failing on a regression of more than 20%. ADR 0007 kept `pnpm e2e:perf` out of CI because timings on shared runners are too noisy to gate PRs, and left the budgets to be set "on CI's runners" in 5.1.

Two things make a fixed baseline unworkable:
- **A runner's speed isn't fixed.** GitHub's standard runners differ from run to run by more than 20%. A baseline committed from one run would fail PRs on the next runner's speed alone.
- **The budgets are the app's, end to end.** Architecture §10 times what the person sees: a keystroke to the painted canvas, an edit to the preview's browser. A benchmark of the pipeline's own call is only part of that. On this computer, a theme colour's preview build takes 83 ms of the 100 ms budget, before the server's message and the browser's swap.

Vitest 5 changed its benchmarks. They are tests in `*.bench.ts` files, run by `vitest bench`, with a `bench` fixture:
- `bench(name, options, fn).run()` gives tinybench's statistics;
- `writeResult` writes them to a file;
- `bench.from(name, source)` reads one back as a baseline.

## Decision
1. **`bench/`, a workspace package of its own** (`@webforge/bench`), outside `pnpm test`'s projects and coverage. `pnpm bench` runs its files one at a time. They measure, on ADR 0004's 20-section page and §10's 20-page site:
   - the history: a keystroke's edit, undo and redo, and a jump through 50 steps;
   - autosave's commit of one changed page;
   - a full export with its images cached;
   - the preview's build after a page edit, and after a theme colour change;
   - Site Check before a publish.
2. **Each benchmark compares its median with `main`'s, on the same runner.** `measure()` (`bench/src/measure.ts`) writes the result to `bench/results/<name>.json`. When `BENCH_BASELINE` names another run's results folder, it reads the same benchmark back with `bench.from` and fails if the median is more than 20% slower. A difference under 0.1 ms never counts, since sub-millisecond benchmarks move more than that with noise alone. Each test retries twice before it fails.
3. **CI's Benchmarks job** runs when a PR changes what the benchmarks measure (the `changes` job's `bench` output). It runs first on `main` as the PR would merge into it: the merge commit's first parent, checked out as a worktree with its own install. Then it runs on the merge commit with `BENCH_BASELINE` pointing at `main`'s results. "CI passed" needs it. Nightly, `main` runs alone, so a broken benchmark shows before a PR meets it. When `main` has no `bench/` yet, nothing is compared.
4. **The §10 budgets aren't asserted by the benchmarks.** Each prints its budget beside its median. The budgets are checked where §10 means them: the app's own end-to-end timings (`pnpm e2e:perf`), on the Windows and macOS reference machines (5.1's later parts).

## Consequences
- A PR that makes the history, a commit, an export, the preview's build or Site Check more than 20% slower fails CI, whatever runner it lands on. A slowdown spread over several PRs, each under 20%, passes. The nightly run's printed medians show that drift.
- The job takes two installs and two runs, about 5 minutes. It runs only when measured code changes.
- A benchmark new in a PR has no baseline, so it can't fail until it is on `main`.
- Results stay out of git (`bench/results/` is ignored).

### Alternatives
- **A baseline committed from one CI run, as Vitest's guide suggests.** Runner speed would fail PRs.
- **A baseline from the last nightly run, as an artifact.** It has the same problem, plus a store to keep.
- **`pnpm e2e:perf` in every PR's CI.** ADR 0007 measured its noise. The whole app, end to end, varies too much between runs to gate at 20%.
