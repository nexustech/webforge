import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, test } from "@playwright/test";
import { ProjectStore } from "@webforge/storage";
import { largeSiteEdits } from "../app/large-site.js";
import { launchDesktopApp, waitForCanvas } from "../app/launch.js";
import type { RendererWindow } from "../app/sites.js";

// Commit time (architecture §10, ADR 0003): committing one changed page of a 225-node site, from
// the renderer: IPC, the main process's check of the whole site, and the SQLite transaction with
// fsync. Here rather than in `pnpm e2e` (ADR 0007, #338): on a shared runner, the first commits
// after the site opens wait for the renderer drawing the page and the canvas CSS compiling.

const COMMIT_BUDGET_MS = 50;
/** Commits before the measured ones, while the app finishes opening the site. */
const WARM_UP = 3;
const MEASURED = 7;

let dir: string;
let app: ElectronApplication | undefined;

test.afterEach(async () => {
  await app?.close();
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

test("commits one changed page of a 225-node site within its budget", async () => {
  dir = mkdtempSync(join(tmpdir(), "webforge-commit-perf-"));
  const sitePath = join(dir, "Large.wforge");
  const { site, changeLists } = largeSiteEdits(WARM_UP + MEASURED);
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
  console.log(
    `Commit of one 225-node page: median ${median.toFixed(1)} ms (budget ${COMMIT_BUDGET_MS} ms)`,
    durations.map((duration) => Math.round(duration * 10) / 10),
  );
  // Soft, like the other budgets here: a miss is reported, not hidden.
  expect.soft(median).toBeLessThan(COMMIT_BUDGET_MS);
});
