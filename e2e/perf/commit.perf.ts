import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, test } from "@playwright/test";
import { ProjectStore } from "@webforge/storage";
import { largeSiteEdits } from "../app/large-site.js";
import { launchDesktopApp, waitForCanvas } from "../app/launch.js";
import type { RendererWindow } from "../app/sites.js";
import type { TimedStep } from "../app/steps.js";

// Commit time (architecture §10, ADR 0003): committing one changed page of a site, from the
// renderer: IPC, the main process's check of the changes, and the SQLite transaction with fsync.
// Measured on a site of one 225-node page and on one of 21 such pages, where only the changed page
// should cost anything (R13a). Here rather than in `pnpm e2e` (ADR 0007, #338): on a shared runner,
// the first commits after the site opens wait for the renderer drawing the page and the canvas CSS
// compiling.
//
// What's checked is our part (#1621, the owner's choice): each commit's time less the disk's
// flush, BEGIN and COMMIT's fsync, which main times for these tests. The flush is a runner's disk
// (16 of 20 ms on Windows' runners, varying night to night), so it and the time end to end, against
// §10's 50 ms, are recorded and printed on every run, not failed.

/** §10's budget for a commit, end to end: recorded, and noted when over. */
const COMMIT_BUDGET_MS = 50;
/** Our part of a commit, its time less the flush: about 4 ms on CI's runners, so a slowdown shows. */
const OUR_PART_BUDGET_MS = 15;
/** Commits before the measured ones, while the app finishes opening the site. */
const WARM_UP = 3;
const MEASURED = 15;

/** The median of `values`. */
function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.POSITIVE_INFINITY;
}

/** `ms` to a tenth. */
const tenth = (ms: number) => Math.round(ms * 10) / 10;

// Not in test-results/: Playwright empties that folder at the start of every run.
const RESULTS = join(import.meta.dirname, "../perf-results/commit.json");

let dir: string;
let app: ElectronApplication | undefined;

// Each run's file holds that run's cases only: a run of one case (--grep) leaves no old numbers of
// the other.
test.beforeAll(() => {
  rmSync(RESULTS, { force: true });
});

test.afterEach(async () => {
  await app?.close();
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

/** Adds `name`'s result to the results file, keeping the other case's from this run. */
function record(name: string, result: Record<string, unknown>): void {
  mkdirSync(join(RESULTS, ".."), { recursive: true });
  let results: Record<string, unknown> = {};
  try {
    results = JSON.parse(readFileSync(RESULTS, "utf8")) as Record<string, unknown>;
  } catch {
    // The run's first case.
  }
  writeFileSync(RESULTS, `${JSON.stringify({ ...results, [name]: result }, null, 2)}\n`);
}

for (const { name, otherPages } of [
  { name: "onePage", otherPages: 0 },
  { name: "twentyOnePages", otherPages: 20 },
]) {
  test(`commits one changed page of a site of ${otherPages + 1} 225-node pages within its budget`, async () => {
    dir = mkdtempSync(join(tmpdir(), "webforge-commit-perf-"));
    const sitePath = join(dir, "Large.wforge");
    const { site, changeLists } = largeSiteEdits(WARM_UP + MEASURED, otherPages);
    const store = ProjectStore.create(sitePath, { name: "Large" });
    store.saveSite(site);
    store.close();
    app = await launchDesktopApp({ motion: true, args: [sitePath] });
    const page = await app.firstWindow();
    await waitForCanvas(page);
    await expect(page.getByRole("banner").getByRole("status")).toHaveText("Saved");

    // Each commit's time, and when it started and ended on the clock main's steps use.
    const commits = await page.evaluate(
      async ({ changes }) => {
        const { project } = (window as unknown as RendererWindow).webforge;
        const sessionId = (await project.getCurrent())?.sessionId ?? "";
        const timed: { ms: number; from: number; to: number }[] = [];
        for (const list of changes) {
          const from = Date.now();
          const start = performance.now();
          const result = await project.commit(sessionId, list);
          timed.push({ ms: performance.now() - start, from, to: Date.now() });
          if ((result as { status: string }).status !== "saved") throw new Error("not saved");
        }
        return timed;
      },
      { changes: changeLists },
    );
    const steps = await app.evaluate(
      () =>
        (
          globalThis as { webforgeStepTimings?: () => readonly TimedStep[] }
        ).webforgeStepTimings?.() ?? [],
    );
    const flushes = steps.filter((each) => each.step === "a write's flush");

    // Each measured commit, paired with the flush that ended within it: its last, as a first
    // change of the day saves a version first.
    const measured = commits.slice(WARM_UP).map((commit) => {
      const within = flushes.filter((each) => each.at >= commit.from && each.at <= commit.to);
      const flush = within.at(-1)?.ms;
      if (flush === undefined) throw new Error("Main timed no flush for a commit");
      return { total: commit.ms, flush, ours: commit.ms - flush };
    });
    const result = {
      pages: otherPages + 1,
      medianMs: tenth(median(measured.map((each) => each.total))),
      ourPartMedianMs: tenth(median(measured.map((each) => each.ours))),
      flushMedianMs: tenth(median(measured.map((each) => each.flush))),
      totals: commits.map((each) => tenth(each.ms)),
      flushes: measured.map((each) => tenth(each.flush)),
    };
    record(name, result);
    console.log(
      `Commit of one page of ${otherPages + 1}: our part's median ${result.ourPartMedianMs} ms (budget ${OUR_PART_BUDGET_MS} ms); the flush's ${result.flushMedianMs} ms and end to end ${result.medianMs} ms (§10's ${COMMIT_BUDGET_MS} ms), recorded`,
      result.totals,
      result.flushes,
    );
    if (result.medianMs >= COMMIT_BUDGET_MS) {
      const description = `A commit of one page of ${otherPages + 1} took ${result.medianMs} ms end to end (median), ${result.flushMedianMs} ms of it the disk's flush; §10's budget is ${COMMIT_BUDGET_MS} ms`;
      test.info().annotations.push({ type: "over budget", description });
      console.log(`Over budget: ${description}`);
    }
    // Soft, like the other budgets here: a miss is reported, not hidden.
    expect
      .soft(result.ourPartMedianMs, "our part of a commit, median (ms)")
      .toBeLessThan(OUR_PART_BUDGET_MS);
  });
}
