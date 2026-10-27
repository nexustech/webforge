import {
  type Browser,
  chromium,
  type ElectronApplication,
  expect,
  type Page,
  test,
} from "@playwright/test";
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
  const before = await site
    .locator("a.btn")
    .first()
    .evaluate((link) => getComputedStyle(link).backgroundColor);
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
  await expect
    .poll(
      () =>
        site
          .locator("a.btn")
          .first()
          .evaluate((link) => getComputedStyle(link).backgroundColor),
      { timeout: 15_000 },
    )
    .not.toBe(before);
  expect(await site.evaluate(() => (window as unknown as { stillHere?: boolean }).stillHere)).toBe(
    true,
  );

  // Another page shown in the editor: the browser goes there.
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByRole("combobox").pressSequentially("page not found");
  await page
    .getByRole("dialog", { name: "Commands" })
    .getByRole("option", { name: "Page not found" })
    .click();
  await expect(site).toHaveURL(/\/404\.html$/, { timeout: 15_000 });
  await expect(site.locator("h1")).toHaveText("Sorry, this page doesn't exist");
});

test("serves nothing without the preview's secret path", async () => {
  const [url] = await opened();
  const { origin } = new URL(url ?? "");
  const response = await (await browser.newPage()).goto(`${origin}/index.html`);
  expect(response?.status()).toBe(404);
});
