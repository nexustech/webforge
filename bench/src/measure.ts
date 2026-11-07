import type { TestContext } from "vitest";

// One benchmark of the suite (5.1, standards §5): run, written to `results/<name>.json`, and its
// median printed beside its budget (architecture §10). Nothing is asserted here: CI compares two
// commits' results, run in interleaved rounds on one runner (`tools/src/compare-bench.ts`,
// ADR 0022), since a shared runner's speed isn't the reference machine's, and the budgets are the
// app's end to end (`pnpm e2e:perf`).

/** How a benchmark runs: a fixed number of iterations for the slow ones, or for long enough. */
export type MeasureOptions = {
  /** The app's budget for all of what this is part of, in milliseconds (§10); printed only. */
  readonly budgetMs?: number;
  readonly iterations?: number;
  /** The least time to keep iterating for, in milliseconds. */
  readonly time?: number;
  readonly warmupIterations?: number;
};

/**
 * Runs `fn` as benchmark `name` in the test whose `bench` fixture this is, writes its result to
 * `results/<name>.json`, and prints its median.
 */
export async function measure(
  bench: TestContext["bench"],
  name: string,
  fn: () => unknown,
  options: MeasureOptions = {},
): Promise<void> {
  const { budgetMs, ...run } = options;
  const result = await bench(name, { writeResult: `results/${name}.json` }, fn).run(run);
  const median = result.latency.p50 ?? result.latency.mean;
  console.log(
    `${name}: median ${median.toFixed(2)} ms` +
      (budgetMs === undefined ? "" : `, the app's budget for all of it ${budgetMs} ms (§10)`),
  );
}
