import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { ProjectStore } from "@webforge/storage";
import { largeSiteEdits } from "../app/large-site.js";
import { launchDesktopApp, waitForCanvas } from "../app/launch.js";
import { stubFileDialogs } from "../app/sites.js";

// A full export of a 20-page site in under 5 s, its images cached (architecture §10, 5.1): from
// Export… to the report, through the export worker, written to a folder. Twenty pages of 225
// elements, exported twice: the second is §10's case, with the worker's caches warm, as when the
// person exports again after an edit.

const PAGES = 20;
const EXPORT_BUDGET_MS = 5_000;

// Not in test-results/: Playwright empties that folder at the start of every run.
const RESULTS = join(import.meta.dirname, "../perf-results/export.json");

let dir: string;
let app: ElectronApplication | undefined;

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

/** Exports the open site to `folder` and gives how long it took, from Export… to the report. */
async function exportTo(page: Page, folder: string): Promise<number> {
  if (app === undefined) throw new Error("The app isn't running");
  await stubFileDialogs(app, folder);
  await page.getByRole("button", { name: "Export Site…", exact: true }).click();
  const options = page.getByRole("dialog", { name: "Export Site" });
  await expect(options).toBeVisible();
  const started = Date.now();
  await options.getByRole("button", { name: "Export…" }).click();
  const report = page.getByRole("dialog", { name: "Site exported" });
  await expect(report).toBeVisible({ timeout: 60_000 });
  const took = Date.now() - started;
  await expect(report).toContainText(/Pages: \d+/);
  await report.getByRole("button", { name: "Done" }).click();
  return took;
}

test(`exports a ${PAGES}-page site in under 5 s, its caches warm (§10)`, async () => {
  dir = mkdtempSync(join(tmpdir(), "webforge-export-perf-"));
  const sitePath = join(dir, "Large.wforge");
  const store = ProjectStore.create(sitePath, { name: "Large" });
  const { site } = largeSiteEdits(1, PAGES - 1);
  // A web address, so Export doesn't ask for one first.
  store.saveSite({
    ...site,
    settings: { ...site.settings, address: { url: "https://large.example" } },
  });
  store.close();
  app = await launchDesktopApp({ userDataDir: join(dir, "user-data"), args: [sitePath] });
  const page = await app.firstWindow();
  await waitForCanvas(page);

  const first = await exportTo(page, join(dir, "first"));
  const again = await exportTo(page, join(dir, "again"));

  mkdirSync(join(RESULTS, ".."), { recursive: true });
  writeFileSync(RESULTS, `${JSON.stringify({ pages: PAGES, first, again }, null, 2)}\n`);
  console.log(
    `Export of ${PAGES} pages: first ${first} ms, again ${again} ms (budget ${EXPORT_BUDGET_MS} ms)`,
  );
  expect(again).toBeLessThan(EXPORT_BUDGET_MS);
});
