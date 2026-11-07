import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type TestContext } from "vitest";

// One benchmark of the suite (5.1, standards §5): run, written to `results/<name>.json`, and
// checked against the same benchmark of the commit this one is compared with, when there is one.
// Its budget (architecture §10) is printed beside it, not asserted: a shared CI runner's speed
// isn't the reference machine's, and the app's own end-to-end timings (`pnpm e2e:perf`) are what
// the budgets are for. Comparing two commits on one machine cancels its speed out.

/** How much slower than its baseline a benchmark may be: CI fails on a regression of > 20%. */
const REGRESSION = 0.2;

/**
 * A slowdown under this many milliseconds is never a regression: a benchmark taking a fraction of
 * a millisecond moves by more than 20% with the machine's noise alone.
 */
const NOISE_MS = 0.1;

/** How a benchmark runs: a fixed number of iterations for the slow ones, or for long enough. */
export type MeasureOptions = {
  /** Its budget in milliseconds (§10), for the whole of what the app does; none without one. */
  readonly budgetMs?: number;
  readonly iterations?: number;
  /** The least time to keep iterating for, in milliseconds. */
  readonly time?: number;
  readonly warmupIterations?: number;
};

/** The median time of one iteration, in milliseconds, from a benchmark's result. */
export type Timing = { readonly median: number };

/** The folder the commit to compare with wrote its results into: `BENCH_BASELINE`, if set. */
function baselineDir(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const dir = env.BENCH_BASELINE;
  return dir === undefined || dir === "" ? undefined : dir;
}

/**
 * Whether `current` is a regression of `baseline`: more than {@link REGRESSION} slower, and by at
 * least {@link NOISE_MS}.
 */
function regressed(current: Timing, baseline: Timing): boolean {
  return (
    current.median > baseline.median * (1 + REGRESSION) &&
    current.median - baseline.median >= NOISE_MS
  );
}

/** A result's median, from the statistics Vitest's benchmarks give (tinybench's `latency`). */
function timingOf(result: { readonly latency: { readonly p50?: number; readonly mean: number } }) {
  return { median: result.latency.p50 ?? result.latency.mean };
}

/**
 * Runs `fn` as benchmark `name` in the test whose `bench` fixture this is, writes its result to
 * `results/<name>.json`, and checks its median against its baseline's.
 */
export async function measure(
  bench: TestContext["bench"],
  name: string,
  fn: () => unknown,
  options: MeasureOptions = {},
): Promise<Timing> {
  const { budgetMs, ...run } = options;
  const result = await bench(name, { writeResult: `results/${name}.json` }, fn).run(run);
  const timing = timingOf(result);
  console.log(
    `${name}: median ${timing.median.toFixed(2)} ms` +
      (budgetMs === undefined ? "" : `, the app's budget for all of it ${budgetMs} ms (§10)`),
  );
  const dir = baselineDir();
  const file = dir === undefined ? undefined : join(dir, `${name}.json`);
  // A benchmark new in this commit has no baseline yet.
  if (file !== undefined && existsSync(file)) {
    const baseline = timingOf(
      await bench.from(`${name} (baseline)`, () => JSON.parse(readFileSync(file, "utf8"))).run(),
    );
    expect(
      regressed(timing, baseline),
      `${name}: median ${timing.median.toFixed(2)} ms, against ${baseline.median.toFixed(2)} ms before (more than ${REGRESSION * 100}% slower)`,
    ).toBe(false);
  }
  return timing;
}
