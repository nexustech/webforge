import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";
import { stubFileDialogs } from "./sites.js";

// The smallest window there is, 960 × 600 (#1166): a site opened there for the first time shows
// its page at a size to read, with the left column as its strip, and a side column opened there
// folds the other instead of squeezing the page.

let app: ElectronApplication;
let page: Page;
let dir: string;

test.beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "webforge-small-"));
  // The start screen first, made small, so the site opens at that size: its first layout.
  app = await launchDesktopApp({ site: false });
  page = await app.firstWindow();
  await expect(page.getByRole("heading", { name: "Get started" })).toBeVisible();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.unmaximize());
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.setContentSize(960, 600),
  );
  await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(960);
  await stubFileDialogs(app, join(dir, "Bakery.wforge"));
  await page
    .getByRole("button", { name: "Choose a Template Yourself…", exact: true })
    .first()
    .click();
  const newSite = page.getByRole("dialog", { name: "New Site" });
  await newSite.getByRole("textbox", { name: "Site name" }).fill("Bakery");
  await newSite.getByRole("button", { name: "Create" }).click();
  await waitForCanvas(page);
  await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(960);
});

test.afterEach(async () => {
  await app.close();
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

const toolbar = () => page.getByRole("toolbar", { name: "Canvas" });

/** The canvas's zoom, as its Zoom box says it: "Fit (62%)" → 62. */
async function zoomPercent(): Promise<number> {
  const shown = await toolbar()
    .getByRole("combobox", { name: "Zoom" })
    .locator("option:checked")
    .textContent();
  const match = /(\d+)%/.exec(shown ?? "");
  return match === null ? 0 : Number(match[1]);
}

test("opens a site at a size to read, the left column a strip, Publish and Site Check named (#1166)", async () => {
  await expect(page.getByRole("region", { name: "Left panels" })).toBeHidden();
  // 58% at 960 × 600: the frame is 590 px against Desktop's 1024 px minimum (PH2-18). Reaching 60%
  // would narrow the Edit panel below #1007's width or take the canvas's padding (#1166's acceptance).
  await expect.poll(zoomPercent).toBeGreaterThanOrEqual(58);

  // Their words, not only coloured icons: Publish, and what Site Check found.
  const banner = page.getByRole("banner");
  await expect(banner.getByRole("button", { name: "Publish" })).toHaveText("Publish");
  await expect(banner.getByRole("button", { name: /^Site Check: / })).toHaveText(
    /\d+ to fix|tips?|No problems/,
  );
});

test("folds the right column when the left one opens there, the page at half or more (#1166)", async () => {
  await chooseFromMenu(app, page, "View", "Show or Hide Left Panels");
  await expect(page.getByRole("region", { name: "Left panels" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Right panels" })).toBeHidden();
  await expect.poll(zoomPercent).toBeGreaterThanOrEqual(50);
});
