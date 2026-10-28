import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, test } from "@playwright/test";
import { ProjectStore } from "@webforge/storage";
import { largeSiteEdits } from "../app/large-site.js";
import { launchDesktopApp, waitForCanvas } from "../app/launch.js";
import type { RendererWindow } from "../app/sites.js";

// Commit time (architecture §10, ADR 0003): committing one changed page of a site, from the
// renderer: IPC, the main process's check of the changes, and the SQLite transaction with fsync.
// Measured on a site of one 225-node page and on one of 21 such pages, where only the changed page
// should cost anything (R13a). Here rather than in `pnpm e2e` (ADR 0007, #338): on a shared runner,
// the first commits after the site opens wait for the renderer drawing the page and the canvas CSS
// compiling.

const COMMIT_BUDGET_MS = 50;
/** Commits before the measured ones, while the app finishes opening the site. */
const WARM_UP = 3;
const MEASURED = 7;

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
    app = await launchDesktopApp({ args: [sitePath] });
    const page = await app.firstWindow();
    await waitForCanvas(page);
    await expect(page.getByRole("banner").getByRole("status")).toHaveText("Saved");

    const durations = await page.evaluate(
      async ({ changes }) => {
        const { project } = (window as unknown as RendererWindow).webforge;
        const sessionId = (await project.getCurrent())?.sessionId ?? "";
        const times: number[] = [];
        for (const list of changes) {
          const start = performance.now();
          const result = await project.commit(sessionId, list);
          times.push(performance.now() - start);
          if ((result as { status: string }).status !== "saved") throw new Error("not saved");
        }
        return times;
      },
      { changes: changeLists },
    );

    const measured = durations.slice(WARM_UP).sort((a, b) => a - b);
    const median = measured[Math.floor(measured.length / 2)] ?? Number.POSITIVE_INFINITY;
    const rounded = durations.map((duration) => Math.round(duration * 10) / 10);
    record(name, { pages: otherPages + 1, medianMs: Math.round(median * 10) / 10, rounded });
    console.log(
      `Commit of one page of ${otherPages + 1}: median ${median.toFixed(1)} ms (budget ${COMMIT_BUDGET_MS} ms)`,
      rounded,
    );
    // Soft, like the other budgets here: a miss is reported, not hidden.
    expect.soft(median).toBeLessThan(COMMIT_BUDGET_MS);
  });
}
