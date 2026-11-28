import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, test } from "@playwright/test";
import { OPEN_WAIT } from "../app/budget.js";
import { launchDesktopApp, removeWhenFree } from "../app/launch.js";
import { stubFileDialogs } from "../app/sites.js";
import { stepsSince } from "../app/steps.js";
import { createFromTemplate, TEMPLATES, type Template } from "../app/templates.js";

// Opening a site in under 3 s (spec/02, F-SITE-1): each template made from New Site, timed from
// Create to its home page's heading on the canvas. Here, on a quiet machine, rather than in
// `pnpm e2e`, whose runs check the opening's CPU time and a loose backstop instead (ADR 0014).

const OPEN_BUDGET_MS = 3_000;
/**
 * Openings of each template, each in a freshly launched app, whose median is checked (#1621): one
 * opening on a slow night of a runner whose speed varies threefold sat about 100 ms under 3 s, so
 * one slow opening failed it.
 */
const OPENINGS = 3;

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
  void removeWhenFree(dir);
});

/** A template's openings: each one's time, and their median. */
type Openings = { readonly openingsMs: readonly number[]; readonly medianMs: number };

/** Adds `name`'s times to the results file, keeping this run's others. */
function record(name: string, times: Openings): void {
  mkdirSync(join(RESULTS, ".."), { recursive: true });
  let results: Record<string, unknown> = {};
  try {
    results = JSON.parse(readFileSync(RESULTS, "utf8")) as Record<string, unknown>;
  } catch {
    // The run's first case.
  }
  writeFileSync(RESULTS, `${JSON.stringify({ ...results, [name]: times }, null, 2)}\n`);
}

/** Makes `template`'s site in a freshly launched app: how long it took, and main's steps. */
async function openOnce(
  template: Template,
): Promise<{ readonly ms: number; readonly steps: string }> {
  dir = mkdtempSync(join(tmpdir(), "webforge-open-perf-"));
  const launched = await launchDesktopApp({
    motion: true,
    userDataDir: join(dir, "user-data"),
    site: false,
  });
  app = launched;
  const page = await launched.firstWindow();
  await expect(page.getByRole("heading", { name: "Get started" })).toBeVisible();
  await stubFileDialogs(launched, join(dir, "Site.wforge"));
  let started = 0;
  await createFromTemplate(page, template, async () => {
    started = Date.now();
  });
  await expect(
    page.frameLocator(".editor__canvas iframe").locator("h1", { hasText: template.heading }),
  ).toBeVisible({ timeout: OPEN_WAIT });
  const ms = Date.now() - started;
  const steps = await stepsSince(launched, started);
  await launched.close();
  app = undefined;
  void removeWhenFree(dir);
  return { ms, steps };
}

for (const template of TEMPLATES) {
  test(`opens a ${template.title} site in under 3 s (F-SITE-1)`, async () => {
    // Three launches and closes, each up to its opening's wait and a slow runner's start.
    test.setTimeout(OPENINGS * 90_000);
    const openings: { readonly ms: number; readonly steps: string }[] = [];
    for (let run = 0; run < OPENINGS; run++) openings.push(await openOnce(template));
    const openingsMs = openings.map((each) => each.ms);
    const medianMs = [...openingsMs].sort((a, b) => a - b)[Math.floor(OPENINGS / 2)] ?? 0;
    record(template.title, { openingsMs, medianMs });
    console.log(
      `${template.title}: opened in ${openingsMs.join(", ")} ms, median ${medianMs} ms (budget ${OPEN_BUDGET_MS} ms)`,
    );
    // A miss names each opening's steps, so a wait shows where it was (#1560, #1621).
    const steps = openings.map((each) => `${each.ms} ms: ${each.steps}`).join("\n");
    expect(medianMs, `the median opening; each one's steps:\n${steps}`).toBeLessThan(
      OPEN_BUDGET_MS,
    );
  });
}
