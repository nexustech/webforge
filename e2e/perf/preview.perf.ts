import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { request } from "node:http";
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

/**
 * When the site last changed in the editor (the perf build's hook), by the same clock as this
 * process's: the edit landing, apart from the clicks and dialogs that made it.
 */
const lastChange = () =>
  page.evaluate(
    () =>
      (
        window as unknown as { __webforgePerf?: { lastChange(): number } }
      ).__webforgePerf?.lastChange() ?? 0,
  );

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

/** The theme's brand colour as the page in the browser has it, from its stylesheet. */
const brand = () =>
  site.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim(),
  );

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
  // The first change saves the person's own theme; the one timed is the second, once the first
  // has reached the browser.
  const initial = await brand();
  await brandColour("b0306a", () =>
    page.getByRole("alertdialog").getByRole("button", { name: "Change Colour" }).click(),
  );
  await expect.poll(brand, { timeout: OPEN_WAIT }).not.toBe(initial);
  const before = await brand();

  // The page notes, by its own clock, the frame its colour changes in: no test round trip in it.
  await site.evaluate((previous) => {
    const watch = () => {
      const now = getComputedStyle(document.documentElement)
        .getPropertyValue("--color-primary")
        .trim();
      if (now !== previous) Object.assign(window, { colourAt: Date.now() });
      else requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  }, before);
  let started = 0;
  const swapped = nextEvent(site.url(), "values");
  await brandColour("2a6fb0", async () => {
    const confirm = page.getByRole("alertdialog").getByRole("button", { name: "Change Colour" });
    started = Date.now();
    await confirm.click();
  });
  await site.waitForFunction(
    (previous) =>
      getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim() !==
      previous,
    before,
    { polling: "raf", timeout: OPEN_WAIT },
  );
  const shown = await site.evaluate(() => (window as unknown as { colourAt: number }).colourAt);
  const edited = await lastChange();
  const took = shown - edited;
  const told = (await swapped) - edited;
  record("css", took);
  record("css: build", told);
  record("css: from the click", shown - started);
  console.log(
    `A theme colour reached the browser ${took} ms after the edit (budget ${CSS_BUDGET_MS} ms): ` +
      `${told} ms to the server's values event, ${took - told} ms for the browser to take them; ` +
      `${shown - started} ms from the click`,
  );
  expect(took).toBeLessThan(CSS_BUDGET_MS);
});

/**
 * When the server next sends `event` (a reload, or the theme's values), as this process's clock
 * has it: what the editor and the build take, apart from what the browser does with it.
 */
function nextEvent(url: string, event: "reload" | "values"): Promise<number> {
  const { origin, pathname } = new URL(url);
  const base = pathname.slice(0, pathname.indexOf("/", 1) + 1);
  return new Promise((resolve, reject) => {
    const sent = request(`${origin}${base}__webforge/events`, (response) => {
      response.on("data", (chunk: Buffer) => {
        if (chunk.toString("utf8").includes(`event: ${event}`)) {
          resolve(Date.now());
          sent.destroy();
        }
      });
    });
    sent.on("error", reject);
    sent.end();
  });
}

test("a changed page is re-rendered and sent to the browser in under 200 ms", async () => {
  const canvas = page.frameLocator(".editor__canvas iframe");
  await canvas.locator("h1").dblclick();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("Fresh bread daily");
  const reloaded = nextEvent(site.url(), "reload");
  // The reloaded page's load, as it fires: an expect would see it only at its next poll.
  const loaded = site.waitForEvent("load", { timeout: OPEN_WAIT });
  const started = Date.now();
  await canvas.locator("body").click({ position: { x: 5, y: 5 } });
  await loaded;
  const shown = Date.now();
  const edited = await lastChange();
  const took = shown - edited;
  await expect(site.locator("h1")).toHaveText("Fresh bread daily");
  const told = (await reloaded) - edited;
  record("page", told);
  record("page: with the browser's reload", took);
  // The page is re-rendered and sent within the budget; how long the browser takes to reload a page
  // is the browser's (agreed for 3.2), and printed beside it.
  console.log(
    `A changed page reached the server's reload ${told} ms after the edit (budget ${PAGE_BUDGET_MS} ms); ` +
      `the browser's reload took ${took - told} ms more, ${shown - started} ms from the click`,
  );
  expect(told).toBeLessThan(PAGE_BUDGET_MS);
});
