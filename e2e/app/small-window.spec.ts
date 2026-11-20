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
  const publish = banner.getByRole("button", { name: "Publish" });
  await expect(publish).toHaveText("Publish");
  await expect(banner.getByRole("button", { name: /^Site Check: / })).toHaveText(
    /\d+ to fix|tips?|No problems/,
  );
  // All of it in sight: left of the window's own buttons (Windows, Linux), and nothing cut off.
  const room = await page.evaluate(() => {
    const overlay = (
      navigator as Navigator & {
        windowControlsOverlay?: { visible: boolean; getTitlebarAreaRect(): DOMRect };
      }
    ).windowControlsOverlay;
    return overlay?.visible === true
      ? overlay.getTitlebarAreaRect().right
      : document.documentElement.clientWidth;
  });
  const box = await publish.boundingBox();
  const right = (box?.x ?? Number.POSITIVE_INFINITY) + (box?.width ?? 0);
  // The search box gives way, down to 7 rem (98 px), with the site's name still in it whole, and
  // clear of the buttons either side of it: its least is room it keeps, not room it takes.
  const search = banner.getByRole("button", { name: /^Search commands/ });
  const searchBox = await search.boundingBox();
  const searchLeft = searchBox?.x ?? 0;
  const searchRight = searchLeft + (searchBox?.width ?? 0);
  const redoBox = await banner.getByRole("button", { name: /^Redo/ }).boundingBox();
  const actionsBox = await banner.getByRole("group", { name: "Site actions" }).boundingBox();
  const nameFits = await search
    .getByText("Bakery", { exact: true })
    .evaluate((name) => name.scrollWidth <= name.clientWidth);
  console.log(
    `[work] 960 px title bar: Publish ends at ${right.toFixed(1)} of ${room} px; search box ${searchLeft.toFixed(1)}–${searchRight.toFixed(1)} px`,
  );
  // At least 4 px to spare before the window's own buttons, for a wider count than this site's.
  expect(right).toBeLessThanOrEqual(room - 4);
  expect(await banner.evaluate((header) => header.scrollWidth <= header.clientWidth)).toBe(true);
  expect(searchBox?.width ?? 0).toBeGreaterThanOrEqual(97);
  expect(searchLeft).toBeGreaterThanOrEqual((redoBox?.x ?? 0) + (redoBox?.width ?? 0));
  expect(searchRight).toBeLessThanOrEqual(actionsBox?.x ?? 0);
  expect(nameFits).toBe(true);
});

/** The left column, open: at its 300 px default, not the 200 px a first opening gave (#1166). */
async function expectLeftOpen(): Promise<void> {
  const left = page.getByRole("region", { name: "Left panels" });
  await expect(left).toBeVisible();
  await expect.poll(async () => (await left.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(299);
  await expect(page.getByRole("region", { name: "Right panels" })).toBeHidden();
  await expect.poll(zoomPercent).toBeGreaterThanOrEqual(50);
}

test("folds the right column when the left one opens there, the page at half or more (#1166)", async () => {
  await chooseFromMenu(app, page, "View", "Show or Hide Left Panels");
  await expectLeftOpen();
});

test("opens the left column from its strip at its full width, folding the right (#1166)", async () => {
  await page
    .getByRole("navigation", { name: "Left panels, collapsed" })
    .getByRole("button")
    .first()
    .click();
  await expectLeftOpen();
});
