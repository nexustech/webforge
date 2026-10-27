import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, test } from "@playwright/test";
import { OPEN_WAIT } from "../app/budget.js";
import { launchDesktopApp } from "../app/launch.js";
import { stubFileDialogs } from "../app/sites.js";
import { createFromTemplate, TEMPLATES } from "../app/templates.js";

// Opening a site in under 3 s (spec/02, F-SITE-1): each template made from New Site, timed from
// Create to its home page's heading on the canvas. Here, on a quiet machine, rather than in
// `pnpm e2e`, whose runs check the opening's CPU time and a loose backstop instead (ADR 0014).

const OPEN_BUDGET_MS = 3_000;

// Not in test-results/: Playwright empties that folder at the start of every run.
const RESULTS = join(import.meta.dirname, "../perf-results/open-site.json");

let dir: string;
let app: ElectronApplication | undefined;

// Each run's file holds that run's cases only.
test.beforeAll(() => {
  rmSync(RESULTS, { force: true });
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

/** Adds `name`'s time to the results file, keeping this run's others. */
function record(name: string, ms: number): void {
  mkdirSync(join(RESULTS, ".."), { recursive: true });
  let results: Record<string, number> = {};
  try {
    results = JSON.parse(readFileSync(RESULTS, "utf8")) as Record<string, number>;
  } catch {
    // The run's first case.
  }
  writeFileSync(RESULTS, `${JSON.stringify({ ...results, [name]: ms }, null, 2)}\n`);
}

for (const template of TEMPLATES) {
  test(`opens a ${template.title} site in under 3 s (F-SITE-1)`, async () => {
    dir = mkdtempSync(join(tmpdir(), "webforge-open-perf-"));
    app = await launchDesktopApp({ userDataDir: join(dir, "user-data"), site: false });
    const page = await app.firstWindow();
    await expect(page.getByRole("heading", { name: "Start a site" })).toBeVisible();
    await stubFileDialogs(app, join(dir, "Site.wforge"));
    let started = 0;
    await createFromTemplate(page, template, async () => {
      started = Date.now();
    });
    await expect(
      page.frameLocator(".editor__canvas iframe").locator("h1", { hasText: template.heading }),
    ).toBeVisible({ timeout: OPEN_WAIT });
    const took = Date.now() - started;
    record(template.title, took);
    console.log(`${template.title}: opened in ${took} ms (budget ${OPEN_BUDGET_MS} ms)`);
    expect(took).toBeLessThan(OPEN_BUDGET_MS);
  });
}
