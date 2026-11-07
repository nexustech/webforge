import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  compareFromArgs,
  compareRuns,
  DEFAULT_THRESHOLD,
  formatComparison,
  parseThresholds,
  readRun,
  slower,
} from "./compare-bench.js";

const run = (medians: Record<string, number>) => new Map(Object.entries(medians));
const defaults = () => DEFAULT_THRESHOLD;

describe("slower", () => {
  it("counts more than 20% slower, and by at least the noise floor", () => {
    expect(slower(12.1, 10, DEFAULT_THRESHOLD)).toBe(true);
    expect(slower(12, 10, DEFAULT_THRESHOLD)).toBe(false);
    // Twice as slow, but by a twentieth of a millisecond: noise.
    expect(slower(0.1, 0.05, DEFAULT_THRESHOLD)).toBe(false);
  });
});

describe("compareRuns (ADR 0022)", () => {
  it("fails a benchmark slower in every round and at its best", () => {
    const [jump] = compareRuns(
      [run({ jump: 3.3 }), run({ jump: 3.4 })],
      [run({ jump: 6.6 }), run({ jump: 6.5 })],
      defaults,
    );
    expect(jump).toEqual({
      name: "jump",
      rounds: [
        { base: 3.3, head: 6.6 },
        { base: 3.4, head: 6.5 },
      ],
      best: { base: 3.3, head: 6.5 },
      regressed: true,
    });
  });

  it("passes one lucky-fast base run, or one slow head run, that the other round doesn't repeat", () => {
    // The first base run was lucky: the head is as fast as the second.
    const [lucky] = compareRuns(
      [run({ export: 500 }), run({ export: 680 })],
      [run({ export: 690 }), run({ export: 675 })],
      defaults,
    );
    expect(lucky?.regressed).toBe(false);
    // The head's first run drifted: its second is as fast as the base.
    const [drift] = compareRuns(
      [run({ export: 670 }), run({ export: 680 })],
      [run({ export: 900 }), run({ export: 690 })],
      defaults,
    );
    expect(drift?.regressed).toBe(false);
  });

  it("uses a benchmark's own threshold, and leaves out one only one side has", () => {
    const thresholds = parseThresholds(
      JSON.stringify({ commit: { regression: 0.5, noiseMs: 1, reason: "spread up to ×1.4" } }),
    );
    const comparisons = compareRuns(
      [run({ commit: 10, old: 1 })],
      [run({ commit: 14, added: 1 })],
      thresholds,
    );
    expect(comparisons.map((each) => [each.name, each.regressed])).toEqual([["commit", false]]);
    expect(() => compareRuns([run({})], [], defaults)).toThrow("same number of runs");
    expect(() =>
      parseThresholds(JSON.stringify({ commit: { regression: 0.5, noiseMs: 1 } })),
    ).toThrow();
  });

  it("writes each round's ratio for the log", () => {
    const text = formatComparison(
      compareRuns(
        [run({ keystroke: 0.06 }), run({ keystroke: 0.05 })],
        [run({ keystroke: 0.06 }), run({ keystroke: 0.06 })],
        defaults,
      ),
    );
    expect(text).toBe(
      "ok        keystroke                best 0.060 ms against 0.050 ms, rounds ×1.00 ×1.20",
    );
  });
});

describe("compareFromArgs: the command line CI runs", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "webforge-bench-compare-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  /** A results folder `name` with `medians`, as `pnpm bench` writes them. */
  const results = (name: string, medians: Record<string, number>) => {
    const folder = join(dir, name);
    mkdirSync(folder);
    for (const [bench, p50] of Object.entries(medians)) {
      writeFileSync(join(folder, `${bench}.json`), JSON.stringify({ latency: { p50, mean: p50 } }));
    }
    return folder;
  };

  it("compares the folders after --base and --head, with the thresholds file's room", () => {
    const base = [results("base-1", { commit: 10 }), results("base-2", { commit: 10 })];
    const head = [results("head-1", { commit: 14 }), results("head-2", { commit: 14 })];
    const args = ["--base", ...base, "--head", ...head];

    const failed = compareFromArgs(args);
    expect(failed.ok).toBe(false);
    expect(failed.report).toContain("1 benchmark(s) slower than the base in every round");

    const thresholds = join(dir, "thresholds.json");
    writeFileSync(
      thresholds,
      JSON.stringify({ commit: { regression: 0.5, noiseMs: 1, reason: "spread up to ×1.4" } }),
    );
    expect(compareFromArgs(["--thresholds", thresholds, ...args])).toEqual({
      ok: true,
      report: "ok        commit                   best 14.0 ms against 10.0 ms, rounds ×1.40 ×1.40",
    });
    // A thresholds file that isn't there leaves the default.
    expect(compareFromArgs(["--thresholds", join(dir, "none.json"), ...args]).ok).toBe(false);
  });
});

describe("readRun", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "webforge-bench-results-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("reads each result's median, by its file's name", () => {
    mkdirSync(join(dir, "nested"));
    writeFileSync(
      join(dir, "history-jump.json"),
      JSON.stringify({ latency: { p50: 3.3, mean: 3.4 } }),
    );
    writeFileSync(join(dir, "export-full.json"), JSON.stringify({ latency: { mean: 670 } }));
    writeFileSync(join(dir, "notes.txt"), "not a result");
    expect(readRun(dir)).toEqual(
      new Map([
        ["export-full", 670],
        ["history-jump", 3.3],
      ]),
    );
  });
});
