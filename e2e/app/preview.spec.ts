import {
  type Browser,
  chromium,
  type ElectronApplication,
  expect,
  type Page,
  test,
} from "@playwright/test";
import { expectMedianWithin, hotSwapBudgetMs } from "./budget.js";
import { launchDesktopApp, waitForCanvas } from "./launch.js";

// Preview (3.2, F-PV-1): the title bar's Preview opens the site in the default browser (stubbed:
// the address it would open is kept, and opened here in Chromium), served by the preview server
// from the open site, unsaved edits included. Each edit reaches the browser: a page reloads, a
// colour of the theme swaps the stylesheet in place, and a page switch takes the browser along.

let app: ElectronApplication;
let page: Page;
let browser: Browser;

test.beforeAll(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  await waitForCanvas(page);
  // The addresses Preview would open in the default browser, instead of opening them.
  await app.evaluate(({ shell }) => {
    const opened: string[] = [];
    Object.assign(globalThis, { opened });
    Object.assign(shell, {
      openExternal: async (url: string) => {
        opened.push(url);
      },
    });
  });
  browser = await chromium.launch();
});

test.afterAll(async () => {
  await browser?.close();
  await app?.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");

/** The theme's brand colour as the page in the browser has it, from its stylesheet. */
const brand = (site: Page) =>
  site.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim(),
  );

/** What Preview asked the system to open. */
const opened = () =>
  app.evaluate(() => (globalThis as unknown as { opened: string[] }).opened.slice());

test("opens the site in the browser, and every edit reaches it", async () => {
  await page.getByRole("banner").getByRole("button", { name: "Preview", exact: true }).click();
  await expect.poll(opened).toHaveLength(1);
  const [url] = await opened();
  // This computer only, under the preview's secret path.
  expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/[0-9a-f]{32}\/index\.html$/);

  const site = await browser.newPage();
  await site.goto(url ?? "");
  await expect(site.locator("h1")).toHaveText("Welcome to our business");
  // Nothing without the secret path.
  const { origin } = new URL(url ?? "");
  expect((await (await browser.newPage()).goto(`${origin}/index.html`))?.status()).toBe(404);

  // A word changed on the canvas: the page reloads with it.
  await canvas().locator("h1").dblclick();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("Fresh bread daily");
  await canvas()
    .locator("body")
    .click({ position: { x: 5, y: 5 } });
  await expect(site.locator("h1")).toHaveText("Fresh bread daily", { timeout: 15_000 });

  // A colour of the theme: the stylesheet is swapped in place, the page not reloaded.
  await site.evaluate(() => Object.assign(window, { stillHere: true }));
  const before = await brand(site);
  await page
    .getByRole("region", { name: "Right panels" })
    .getByRole("tab", { name: "Theme", exact: true })
    .click();
  const hex = page.getByRole("textbox", { name: "Brand hex code" });
  await hex.selectText();
  await page.keyboard.type("b0306a");
  await page.keyboard.press("Enter");
  await page
    .getByRole("dialog", { name: "Save your own version of 'Light'?" })
    .getByRole("button", { name: "Save Theme" })
    .click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Change Colour" }).click();
  await expect.poll(() => brand(site), { timeout: 15_000 }).not.toBe(before);
  expect(await site.evaluate(() => (window as unknown as { stillHere?: boolean }).stillHere)).toBe(
    true,
  );

  // Another page shown in the editor: the browser goes there. Out of the hex field first, where
  // Ctrl/Cmd+K is the field's; the Commands dialog's own search, among the panels' many.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("ControlOrMeta+k");
  await page
    .getByRole("dialog", { name: "Commands" })
    .getByRole("combobox")
    .pressSequentially("page not found");
  await page
    .getByRole("dialog", { name: "Commands" })
    .getByRole("option", { name: "Page not found" })
    .click();
  await expect(site).toHaveURL(/\/404\.html$/, { timeout: 15_000 });
  await expect(site.locator("h1")).toHaveText("Sorry, this page doesn't exist");
});

/**
 * Times each stylesheet swap in the page (Phase 3 exit, #622): from the preview's `css` event
 * reaching it to the new stylesheet's `load`, which fires once its rules apply. That is the page's
 * own part of a hot swap: the edit, the build and the server's event before it aren't in it, nor
 * the frame drawn after. The live reload script listens to the events; this wraps
 * `EventSource`'s `addEventListener` to time its `css` listener and the stylesheet it adds.
 */
function timeSwaps() {
  const times: number[] = [];
  Object.assign(window, { stylesheetSwaps: times });
  const add = EventTarget.prototype.addEventListener;
  const timed = function (
    this: EventSource,
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (type !== "css" || typeof listener !== "function") {
      add.call(this, type, listener, options);
      return;
    }
    add.call(
      this,
      type,
      (event) => {
        const reached = performance.now();
        const before = new Set(document.querySelectorAll('link[rel="stylesheet"]'));
        listener.call(this, event);
        for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
          if (before.has(link)) continue;
          link.addEventListener("load", () => times.push(performance.now() - reached), {
            once: true,
          });
        }
      },
      options,
    );
  };
  Object.defineProperty(EventSource.prototype, "addEventListener", { value: timed });
}

test("swaps the stylesheet in place in under 100 ms, the median of five (#622)", async () => {
  // Opened by the test above, or now when it runs alone.
  if ((await opened()).length === 0) {
    await page.getByRole("banner").getByRole("button", { name: "Preview", exact: true }).click();
    await expect.poll(opened).toHaveLength(1);
  }
  const [url] = (await opened()).slice(-1);
  const site = await browser.newPage();
  await site.addInitScript(timeSwaps);
  await site.goto((url ?? "").replace(/\/404\.html$/, "/index.html"));
  await expect(site.locator("h1")).toBeVisible();
  await page
    .getByRole("region", { name: "Right panels" })
    .getByRole("tab", { name: "Theme", exact: true })
    .click();
  const swaps = () =>
    site.evaluate(
      () => (window as unknown as { stylesheetSwaps: number[] }).stylesheetSwaps.length,
    );

  // The buttons' style is in the stylesheet's rules, not its values: each change is a swap.
  for (const style of ["Outline", "Filled", "Outline", "Filled", "Outline"]) {
    const done = await swaps();
    await page.getByRole("combobox", { name: "Button style" }).selectOption({ label: style });
    // A change of a built-in theme first names the person's own copy of it (2.23), and one that
    // reaches every page may ask (D7): each answered as it comes, until the swap does.
    const save = page.getByRole("dialog", { name: /^Save your own version of/ });
    const ask = page.getByRole("alertdialog");
    await expect
      .poll(
        async () => {
          if (await save.isVisible())
            await save.getByRole("button", { name: "Save Theme" }).click();
          else if (await ask.isVisible()) await ask.getByRole("button").last().click();
          return swaps();
        },
        { timeout: 15_000 },
      )
      .toBe(done + 1);
  }

  const times = await site.evaluate(
    () => (window as unknown as { stylesheetSwaps: number[] }).stylesheetSwaps,
  );
  console.log(`[work] stylesheet swaps: ${times.map((ms) => Math.round(ms)).join(", ")} ms`);
  expect(times).toHaveLength(5);
  expectMedianWithin(times, hotSwapBudgetMs(), "The preview's stylesheet swap");
});
