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
  // A narrow title bar: the menus' titles folded into one Menu button, which opens them.
  await expect(banner.getByRole("menuitem", { name: "File", exact: true })).toBeHidden();
  await banner.getByRole("menuitem", { name: "Menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "File", exact: true }).click();
  await expect(page.getByRole("menu", { name: "File" })).toBeVisible();
  await page.keyboard.press("Escape");
  if ((await page.locator('[role="menu"][data-state="open"]').count()) > 0) {
    await page.keyboard.press("Escape");
  }
  await expect(page.getByRole("menu")).toHaveCount(0);

  // The search box at its least, 140 px, the site's name in it whole.
  const search = banner.getByRole("button", { name: /^Search commands/ });
  expect((await search.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(139);
  expect(
    await search
      .getByText("Bakery", { exact: true })
      .evaluate((name) => name.scrollWidth <= name.clientWidth),
  ).toBe(true);

  // With each count Site Check can show there at its widest, all of it in sight, with room to
  // spare.
  for (const count of ["99 to fix", "99 tips", "No problems"]) {
    await expectTitleBarFits(count, 960);
  }
});

test("shows the menus' titles again in a wide window, all of it fitting (#1166)", async () => {
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.setContentSize(1280, 900),
  );
  await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(1280);
  const menuBar = page.getByRole("banner").getByRole("menubar", { name: "App menu" });
  await expect(menuBar.getByRole("menuitem")).toHaveText(["File", "Edit", "View", "Site", "Help"]);
  // The narrowest with them, Site Check's whole count at its widest beside them.
  await expectTitleBarFits("99 to fix · 99 tips", 1280);
});

/**
 * The title bar with Site Check showing `count`: whether any two of its controls are over each
 * other or anything is cut off, where Publish ends against the window's own buttons (Windows,
 * Linux), and how wide the search box is, which takes what's left (#1166).
 */
async function titleBarWith(count: string) {
  return page.getByRole("banner").evaluate((header, shown) => {
    const check = [...header.querySelectorAll("button")].find((button) =>
      (button.getAttribute("aria-label") ?? "").startsWith("Site Check:"),
    );
    const text = [...(check?.querySelectorAll("span") ?? [])].find(
      (span) => getComputedStyle(span).display !== "none",
    );
    if (text !== undefined) text.textContent = shown;
    const overlay = (
      navigator as Navigator & {
        windowControlsOverlay?: { visible: boolean; getTitlebarAreaRect(): DOMRect };
      }
    ).windowControlsOverlay;
    const room =
      overlay?.visible === true
        ? overlay.getTitlebarAreaRect().right
        : document.documentElement.clientWidth;
    // Each control: a button, a menu's title or a choice, not one holding another.
    const controls = [
      ...header.querySelectorAll<HTMLElement>("button, [role='menuitem'], [role='radio']"),
    ]
      .filter((each) => each.getBoundingClientRect().width > 0)
      .filter((each) => each.querySelector("button, [role='menuitem'], [role='radio']") === null);
    const overlaps: string[] = [];
    controls.forEach((a, index) => {
      for (const b of controls.slice(index + 1)) {
        const [ra, rb] = [a.getBoundingClientRect(), b.getBoundingClientRect()];
        if (ra.left < rb.right - 0.5 && rb.left < ra.right - 0.5) {
          overlaps.push(
            `${a.getAttribute("aria-label") ?? a.textContent} × ${b.getAttribute("aria-label") ?? b.textContent}`,
          );
        }
      }
    });
    const publish = controls.find((each) => each.textContent === "Publish");
    const searchBox = header.querySelector("button[aria-haspopup='dialog']");
    return {
      searchWidth: searchBox?.getBoundingClientRect().width ?? 0,
      room,
      publishRight: publish?.getBoundingClientRect().right ?? Number.POSITIVE_INFINITY,
      overlaps,
      cutOff: header.scrollWidth > header.clientWidth,
    };
  }, count);
}

/** Checks {@link titleBarWith} `count`: nothing over or cut off, and 4 px or more to spare. */
async function expectTitleBarFits(count: string, width: number): Promise<void> {
  const layout = await titleBarWith(count);
  console.log(
    `[work] ${width} px title bar, "${count}": Publish ends at ${layout.publishRight.toFixed(1)} of ${layout.room} px, ${(layout.searchWidth - 140).toFixed(1)} px to spare`,
  );
  expect(layout.overlaps, count).toEqual([]);
  expect(layout.cutOff, count).toBe(false);
  expect(layout.publishRight, count).toBeLessThanOrEqual(layout.room);
  // The spare is what the search box has over its least, 140 px.
  expect(layout.searchWidth - 140, count).toBeGreaterThanOrEqual(4);
}

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
