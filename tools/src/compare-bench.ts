// The benchmarks' regression gate (5.1, ADR 0022): compares the results `pnpm bench` wrote for two
// commits, run in interleaved rounds on one machine (base, head, base, head).
//
// Usage (CI's Benchmarks job):
//   node tools/src/compare-bench.ts --thresholds bench/thresholds.json \
//     --base <round 1's results> <round 2's results> --head <round 1's results> <round 2's results>
//
// A benchmark regressed only when the head is too slow against the base in every round, and its
// best median is too slow against the base's best: one lucky-fast base run, or a drift between
// runs, can't fail CI alone.
//
// This file has no relative imports so Node can run it directly with type stripping.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { z } from "zod";

/** How much slower a benchmark may be, and the slowdown in milliseconds under which it never counts. */
export type Threshold = { readonly regression: number; readonly noiseMs: number };

/** The default: more than 20% slower (standards §5), and by at least 0.1 ms. */
export const DEFAULT_THRESHOLD: Threshold = { regression: 0.2, noiseMs: 0.1 };

const thresholdsSchema = z.record(
  z.string(),
  z.strictObject({
    regression: z.number().positive().max(10),
    noiseMs: z.number().nonnegative(),
    /** Why this benchmark needs more room than the default: what its runs' spread was. */
    reason: z.string().min(1),
  }),
);

/** A benchmark's own threshold where `bench/thresholds.json` sets one, else the default. */
export type Thresholds = (name: string) => Threshold;

/** The thresholds in `json`: a benchmark's own, each with its reason, and the default for the rest. */
export function parseThresholds(json: string): Thresholds {
  const own = thresholdsSchema.parse(JSON.parse(json));
  return (name) => own[name] ?? DEFAULT_THRESHOLD;
}

const resultSchema = z.object({
  latency: z.object({ p50: z.number().nonnegative().optional(), mean: z.number().nonnegative() }),
});

/** The median of each benchmark in a run's results folder, by its name (the file's, less `.json`). */
export function readRun(dir: string): Map<string, number> {
  const medians = new Map<string, number>();
  for (const file of readdirSync(dir)
    .filter((each) => each.endsWith(".json"))
    .sort()) {
    const { latency } = resultSchema.parse(JSON.parse(readFileSync(join(dir, file), "utf8")));
    medians.set(basename(file, ".json"), latency.p50 ?? latency.mean);
  }
  return medians;
}

/** Whether `head` is too slow against `base` under `threshold`. */
export function slower(head: number, base: number, threshold: Threshold): boolean {
  return head > base * (1 + threshold.regression) && head - base >= threshold.noiseMs;
}

/** One benchmark compared across the rounds. */
export type Comparison = {
  readonly name: string;
  /** Each round's base and head medians, in milliseconds. */
  readonly rounds: readonly { readonly base: number; readonly head: number }[];
  /** The best (lowest) median of each side. */
  readonly best: { readonly base: number; readonly head: number };
  readonly regressed: boolean;
};

/**
 * Compares the head's runs with the base's, round by round (`base[i]` was run just before
 * `head[i]`). A benchmark only one side has is left out: a new one has no baseline yet.
 */
export function compareRuns(
  base: readonly Map<string, number>[],
  head: readonly Map<string, number>[],
  thresholds: Thresholds,
): Comparison[] {
  if (base.length !== head.length || base.length === 0) {
    throw new Error("Give each side the same number of runs, at least one");
  }
  const names = [...(head[0]?.keys() ?? [])].filter((name) =>
    [...base, ...head].every((run) => run.has(name)),
  );
  return names.map((name) => {
    const rounds = base.map((run, index) => ({
      base: run.get(name) ?? 0,
      head: head[index]?.get(name) ?? 0,
    }));
    const best = {
      base: Math.min(...rounds.map((round) => round.base)),
      head: Math.min(...rounds.map((round) => round.head)),
    };
    const threshold = thresholds(name);
    const regressed =
      slower(best.head, best.base, threshold) &&
      rounds.every((round) => slower(round.head, round.base, threshold));
    return { name, rounds, best, regressed };
  });
}

/** The comparison as a table for the log: each round's ratio, and the verdict. */
export function formatComparison(comparisons: readonly Comparison[]): string {
  const ms = (value: number) => `${value.toFixed(value < 1 ? 3 : 1)} ms`;
  const ratio = (head: number, base: number) => (base === 0 ? "–" : `×${(head / base).toFixed(2)}`);
  const lines = comparisons.map((each) => {
    const rounds = each.rounds.map((round) => ratio(round.head, round.base)).join(" ");
    const verdict = each.regressed ? "REGRESSED" : "ok";
    return `${verdict.padEnd(9)} ${each.name.padEnd(24)} best ${ms(each.best.head)} against ${ms(each.best.base)}, rounds ${rounds}`;
  });
  return lines.join("\n");
}

/** The folders after `flag` in `args`, up to the next flag. */
function foldersAfter(args: readonly string[], flag: string): string[] {
  const start = args.indexOf(flag);
  if (start === -1) return [];
  const rest = args.slice(start + 1);
  const end = rest.findIndex((arg) => arg.startsWith("--"));
  return end === -1 ? rest : rest.slice(0, end);
}

/**
 * Runs the comparison the command line asks for (`--thresholds <file> --base <dirs> --head
 * <dirs>`): what to print, and whether every benchmark passed.
 */
export function compareFromArgs(args: readonly string[]): {
  readonly ok: boolean;
  readonly report: string;
} {
  const [thresholdsFile] = foldersAfter(args, "--thresholds");
  const thresholds =
    thresholdsFile !== undefined && existsSync(thresholdsFile)
      ? parseThresholds(readFileSync(thresholdsFile, "utf8"))
      : () => DEFAULT_THRESHOLD;
  const comparisons = compareRuns(
    foldersAfter(args, "--base").map(readRun),
    foldersAfter(args, "--head").map(readRun),
    thresholds,
  );
  const regressed = comparisons.filter((each) => each.regressed);
  const report = formatComparison(comparisons);
  return regressed.length === 0
    ? { ok: true, report }
    : {
        ok: false,
        report: `${report}\n\n${regressed.length} benchmark(s) slower than the base in every round (ADR 0022): ${regressed.map((each) => each.name).join(", ")}`,
      };
}

if (import.meta.main) {
  const { ok, report } = compareFromArgs(process.argv.slice(2));
  (ok ? console.log : console.error)(report);
  if (!ok) process.exitCode = 1;
}
