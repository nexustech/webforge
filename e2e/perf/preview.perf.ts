import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  type Browser,
  chromium,
  type ElectronApplication,
  expect,
  type Page,
  test,
} from "@playwright/test";
import { OPEN_WAIT } from "../app/budget.js";
import { launchDesktopApp, waitForCanvas } from "../app/launch.js";

// The preview's targets (architecture §10, 3.2): a change to the styles alone reaches the browser
// in under 100 ms, a changed page in under 200 ms, each timed from the edit's last action in the
// editor to the browser showing it. Here, on a quiet machine, rather than in `pnpm e2e`, whose runs
// check what load doesn't move (ADR 0014, ADR 0015).

const CSS_BUDGET_MS = 100;
const PAGE_BUDGET_MS = 200;

// Not in test-results/: Playwright empties that folder at the start of every run.
const RESULTS = join(import.meta.dirname, "../perf-results/preview.json");

let app: ElectronApplication;
let page: Page;
let browser: Browser;
let site: Page;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  rmSync(RESULTS, { force: true });
  app = await launchDesktopApp();
  page = await app.firstWindow();
  await waitForCanvas(page);
  await app.evaluate(({ shell }) => {
    Object.assign(shell, {
      openExternal: async (url: string) => {
        Object.assign(globalThis, { previewUrl: url });
      },
    });
  });
  await page.getByRole("banner").getByRole("button", { name: "Preview", exact: true }).click();
  await expect
    .poll(() => app.evaluate(() => (globalThis as { previewUrl?: string }).previewUrl))
    .toBeDefined();
  const url = await app.evaluate(() => (globalThis as { previewUrl?: string }).previewUrl);
  browser = await chromium.launch();
  site = await browser.newPage();
  await site.goto(url ?? "");
  await expect(site.locator("h1")).toBeVisible({ timeout: OPEN_WAIT });
});

test.afterAll(async () => {
  await browser?.close();
  await app?.close();
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

const buttonColour = () =>
  site
    .locator("a.btn")
    .first()
    .evaluate((link) => getComputedStyle(link).backgroundColor);

/** Sets the theme's brand colour to `hex` in the Theme tab, up to its last click. */
async function brandColour(hex: string, last: () => Promise<void>) {
  const field = page.getByRole("textbox", { name: "Brand hex code" });
  await field.selectText();
  await page.keyboard.type(hex);
  await page.keyboard.press("Enter");
  const save = page.getByRole("dialog", { name: "Save your own version of 'Light'?" });
  if (await save.isVisible()) await save.getByRole("button", { name: "Save Theme" }).click();
  await last();
}

test("a colour of the theme reaches the browser in under 100 ms", async () => {
  await page
    .getByRole("region", { name: "Right panels" })
    .getByRole("tab", { name: "Theme", exact: true })
    .click();
  // The first change saves the person's own theme; the one timed is the second.
  await brandColour("b0306a", () =>
    page.getByRole("alertdialog").getByRole("button", { name: "Change Colour" }).click(),
  );
  await expect.poll(buttonColour, { timeout: OPEN_WAIT }).not.toBe("");
  const before = await buttonColour();

  let started = 0;
  await brandColour("2a6fb0", async () => {
    const confirm = page.getByRole("alertdialog").getByRole("button", { name: "Change Colour" });
    started = Date.now();
    await confirm.click();
  });
  await site.waitForFunction(
    (previous) =>
      getComputedStyle(document.querySelector("a.btn") ?? document.body).backgroundColor !==
      previous,
    before,
    { polling: "raf", timeout: OPEN_WAIT },
  );
  const took = Date.now() - started;
  record("css", took);
  console.log(`A theme colour reached the browser in ${took} ms (budget ${CSS_BUDGET_MS} ms)`);
  expect(took).toBeLessThan(CSS_BUDGET_MS);
});

test("a changed page reaches the browser in under 200 ms", async () => {
  const canvas = page.frameLocator(".editor__canvas iframe");
  await canvas.locator("h1").dblclick();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("Fresh bread daily");
  const started = Date.now();
  await canvas.locator("body").click({ position: { x: 5, y: 5 } });
  await expect(site.locator("h1")).toHaveText("Fresh bread daily", { timeout: OPEN_WAIT });
  const took = Date.now() - started;
  record("page", took);
  console.log(`A changed page reached the browser in ${took} ms (budget ${PAGE_BUDGET_MS} ms)`);
  expect(took).toBeLessThan(PAGE_BUDGET_MS);
});
