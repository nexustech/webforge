import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, test } from "@playwright/test";
import {
  expectMedianWithin,
  expectWorkWithin,
  measureWork,
  OPEN_WAIT,
  openBudget,
  openMedianBudgetMs,
  type Work,
} from "./budget.js";
import { canvasAxe } from "./canvas-axe.js";
import { APP_START_TIMEOUT_MS, launchDesktopApp, removeWhenFree } from "./launch.js";
import { stubFileDialogs } from "./sites.js";
import { createFromTemplate, TEMPLATES } from "./templates.js";

// The templates of 2.15a and 2.15b, made from New Site (F-SITE-1): each opens, with its photos,
// and its home page passes axe on the canvas, what the editor adds to it included. The opening is
// checked by its CPU time and a loose wall-clock backstop; its 3 s by `pnpm e2e:perf` on a quiet
// machine (ADR 0014).

let dir: string;
let app: ElectronApplication | undefined;
/** Each opening's wall-clock time, for their median (#569). */
const openings: number[] = [];

/** A step main timed in an opening (`step-timings.ts`, #1560): durations under fixed names only. */
type TimedStep = { readonly step: string; readonly ms: number; readonly at: number };

/**
 * The steps main timed after `since` (#1560): each one's time and when it ended, in ms after
 * `since`, so the time no step accounts for shows between them.
 */
async function stepsSince(app: ElectronApplication, since: number): Promise<string> {
  // A main that's stuck or gone can't say: the failure being explained still comes through.
  const steps = await app
    .evaluate(
      () =>
        (
          globalThis as { webforgeStepTimings?: () => readonly TimedStep[] }
        ).webforgeStepTimings?.() ?? [],
    )
    .catch(() => undefined);
  if (steps === undefined) return "Main's steps couldn't be read.";
  const after = steps.filter((each) => each.at >= since);
  return after.length === 0
    ? "Main timed no steps after Create."
    : `Each step after Create, its ms (and when it ended, after Create): ${after
        .map((each) => `${each.step} ${each.ms} (+${each.at - since})`)
        .join(", ")}`;
}

/** The app this test launched. */
function running(): ElectronApplication {
  if (app === undefined) throw new Error("The app is not running");
  return app;
}

// A first opening on each worker, untimed, before the timed ones (#1595): a fresh runner's first
// launch pays a one-time cost, the system's not the app's (each test has its own user data),
// which on macOS made the first opening up to 3.6 times the rest's median and once missed its
// 6 s backstop. The openings timed then are each template's as a person opens it, warm.
test.beforeAll(async () => {
  test.setTimeout(2 * 60_000);
  const warm = mkdtempSync(join(tmpdir(), "webforge-templates-warm-"));
  const first = TEMPLATES[0];
  if (first === undefined) throw new Error("No templates");
  const warmApp = await launchDesktopApp({ userDataDir: join(warm, "user-data"), site: false });
  try {
    const page = await warmApp.firstWindow();
    await expect(page.getByRole("heading", { name: "Get started" })).toBeVisible({
      timeout: APP_START_TIMEOUT_MS,
    });
    await stubFileDialogs(warmApp, join(warm, "Site.wforge"));
    await createFromTemplate(page, first);
    await expect(
      page.frameLocator(".editor__canvas iframe").locator("h1", { hasText: first.heading }),
    ).toBeVisible({ timeout: OPEN_WAIT });
  } finally {
    await warmApp.close();
    void removeWhenFree(warm);
  }
});

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-templates-"));
});

// A wait added to every opening, which Windows' backstop lets through (#561, #569).
test.afterAll(() => {
  expectMedianWithin(openings, openMedianBudgetMs(), "Opening the templates' sites");
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  void removeWhenFree(dir);
});

for (const template of TEMPLATES) {
  test(`makes a ${template.title} site within its opening budget, accessible on the canvas (2.15)`, async () => {
    app = await launchDesktopApp({ userDataDir: join(dir, "user-data"), site: false });
    const page = await app.firstWindow();
    await expect(page.getByRole("heading", { name: "Get started" })).toBeVisible({
      timeout: APP_START_TIMEOUT_MS,
    });
    await stubFileDialogs(app, join(dir, "Site.wforge"));

    let opened: (() => Promise<Work>) | undefined;
    let pressed = 0;
    await createFromTemplate(page, template, async () => {
      opened = await measureWork(running());
      pressed = Date.now();
    });
    const canvas = page.frameLocator(".editor__canvas iframe");
    // A stall past the wait says where it was too (#1560).
    await expect(canvas.locator("h1", { hasText: template.heading }))
      .toBeVisible({ timeout: OPEN_WAIT })
      .catch(async (error: unknown) => {
        const said = error instanceof Error ? error.message : String(error);
        throw new Error(`${said}\n${await stepsSince(running(), pressed)}`);
      });
    if (opened === undefined) throw new Error("Not measured");
    const work = await opened();
    openings.push(work.wallMs);
    // Every opening's steps, beside its [work] line: a wait within a backstop shows too, as one of
    // about 4.5 s did on Windows, whose backstop is 30 s (#1560).
    console.log(`[steps] ${template.title}: ${await stepsSince(running(), pressed)}`);
    // Over its budget, judged again against the runner as it is then (#1466). A miss names each
    // step main timed after Create, so a wait shows where it was (#1560).
    await expectWorkWithin(
      work,
      await openBudget(running()),
      `Opening the ${template.title} site`,
      () => openBudget(running(), { fresh: true }),
    ).catch(async (error: unknown) => {
      const said = error instanceof Error ? error.message : String(error);
      throw new Error(`${said}\n${await stepsSince(running(), pressed)}`);
    });
    await expect(canvas.locator("main img, section img").first()).not.toHaveJSProperty(
      "naturalWidth",
      0,
    );

    const results = await canvasAxe(page);
    expect(
      results.violations.map(
        (violation) => `${violation.id}: ${violation.help} (${violation.targets.join(", ")})`,
      ),
    ).toEqual([]);
    expect(results.passes).toBeGreaterThan(5);
  });
}
