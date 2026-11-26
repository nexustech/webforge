import { expect, test } from "@playwright/test";
import { type Budget, checkWork, expectMedianWithin, type Work } from "./budget.js";

// The openings' budgets, with made-up openings: no app is launched.
// - The median of a spec's openings (#569): Windows' backstop catches a hang only (#561), so the
//   median catches a wait added to every opening, while one stalled opening doesn't move it.
// - An opening's CPU budget (#1466): over it, an opening is judged again against a budget
//   calibrated then, and the line says both.

/** Six openings as a Windows runner's usual job made them (#561). */
const USUAL = [1237, 1351, 1288, 1460, 1108, 1575];

test("fails when every opening waits a few seconds more (#569)", () => {
  const waited = USUAL.map((wallMs) => wallMs + 5_000);
  expect(() => expectMedianWithin(waited, 6_000, "Opening")).toThrow(/median took \d+ ms/);
});

test("passes one opening that stalled, as Windows' runners do (#561)", () => {
  const stalled = [21_547, ...USUAL.slice(1)];
  expect(() => expectMedianWithin(stalled, 6_000, "Opening")).not.toThrow();
});

test("leaves a median of too few openings unchecked: a fresh worker's, after a failed test", () => {
  const afterFailure = [21_547, 9_000, ...USUAL.slice(0, 1)];
  expect(() => expectMedianWithin(afterFailure, 6_000, "Opening")).not.toThrow();
});

/** An opening that cost `cpuSeconds` in `wallMs`. */
const work = (cpuSeconds: number, wallMs = 1_500): Work => ({
  cpuSeconds,
  wallMs,
  exited: [],
  byProcess: [["Tab", cpuSeconds]],
});

/** A budget of `cpuSeconds`, from a calibration of `calibration` CPU-s. */
const budget = (cpuSeconds: number, calibration: number): Budget => ({
  cpuSeconds,
  wallMs: 6_000,
  source: `calibration ${calibration}`,
});

/** A stand-in for calibrating again, which counts its calls. */
function recalibrated(to: Budget) {
  let calls = 0;
  return {
    again: async () => {
      calls += 1;
      return to;
    },
    calls: () => calls,
  };
}

test("passes an opening within its budget, without calibrating again", async () => {
  const second = recalibrated(budget(7, 0.29));
  const verdict = await checkWork(work(3.1), budget(4.4, 0.163), "Opening", second.again);
  expect(verdict.failure).toBeUndefined();
  expect(second.calls()).toBe(0);
  expect(verdict.line).toBe(
    "Opening: 3.10 CPU-s of 4.4 (calibration 0.163) (Tab 3.10), 1500 ms of 6000",
  );
});

test("passes an opening over its budget but within one calibrated again, and says both", async () => {
  const second = recalibrated(budget(7.04, 0.29));
  const verdict = await checkWork(work(5.22), budget(4.4, 0.163), "Opening", second.again);
  expect(verdict.failure).toBeUndefined();
  expect(second.calls()).toBe(1);
  expect(verdict.line).toContain(
    "5.22 CPU-s of 4.4 (calibration 0.163): over; again: of 7.04 (calibration 0.29): within",
  );
});

test("fails an opening over both budgets, naming both", async () => {
  const second = recalibrated(budget(4.6, 0.17));
  const verdict = await checkWork(work(5.22), budget(4.4, 0.163), "Opening", second.again);
  expect(verdict.line).toContain("again: of 4.6 (calibration 0.17): over");
  expect(verdict.failure).toBe(
    "Opening cost 5.22 CPU-s, over its 4.4 (calibration 0.163), and over 4.6 (calibration 0.17) calibrated again",
  );
});

test("fails an opening over its budget when there is no calibrating again", async () => {
  const verdict = await checkWork(work(5.22), budget(4.4, 0.163), "Opening");
  expect(verdict.failure).toBe("Opening cost 5.22 CPU-s, over its 4.4 (calibration 0.163)");
});

test("fails an opening over its wall-clock backstop, whatever its CPU", async () => {
  const second = recalibrated(budget(7, 0.29));
  const verdict = await checkWork(work(2, 6_500), budget(4.4, 0.163), "Opening", second.again);
  expect(second.calls()).toBe(0);
  expect(verdict.failure).toBe("Opening took 6500 ms, over its 6000 ms backstop");
});
