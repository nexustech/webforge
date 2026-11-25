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

/** Whether macOS's menu bar holds the menus, so the title bar has none (LF-13). */
const nativeMenus = process.platform === "darwin";

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
  // A narrow title bar: the menus' titles folded into one Menu button, which opens them. macOS has
  // its menus in the system's menu bar, none in the title bar (LF-13).
  if (!nativeMenus) {
    await expect(banner.getByRole("menuitem", { name: "File", exact: true })).toBeHidden();
    await banner.getByRole("menuitem", { name: "Menu", exact: true }).click();
    await page.getByRole("menuitem", { name: "File", exact: true }).click();
    await expect(page.getByRole("menu", { name: "File" })).toBeVisible();
    await page.keyboard.press("Escape");
    if ((await page.locator('[role="menu"][data-state="open"]').count()) > 0) {
      await page.keyboard.press("Escape");
    }
    await expect(page.getByRole("menu")).toHaveCount(0);
  }

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
  await sizeWindow(1280, 900, 1280);
  if (!nativeMenus) {
    const menuBar = page.getByRole("banner").getByRole("menubar", { name: "App menu" });
    await expect(menuBar.getByRole("menuitem")).toHaveText([
      "File",
      "Edit",
      "View",
      "Site",
      "Help",
    ]);
  }
  // The narrowest with them, Site Check's whole count at its widest beside them: nothing over
  // anything else or cut off, though with nothing to spare on Linux, whose type is wider (30 px on
  // Windows, 0 on Linux).
  await expectTitleBarFits("99 to fix · 99 tips", 1280, 0);
});

/**
 * Text size `zoom` in the smallest window a screen `screen` px wide allows (#1195): the window's
 * least grows with the text size, to 960 px times it, but no wider than the screen. A smaller
 * screen is stood in for by lowering the window's least, as only the window's width matters here.
 */
async function atTextSize(zoom: number, screen: number): Promise<number> {
  await page.evaluate(
    (interfaceZoom) =>
      (
        window as unknown as { webforge: { prefs: { set(change: unknown): Promise<unknown> } } }
      ).webforge.prefs.set({ interfaceZoom }),
    zoom,
  );
  const width = Math.min(Math.round(960 * zoom), screen);
  // The page's own width at that zoom, in CSS px: once the window is that wide, not before. A
  // window coming from a wider one is already at least as wide before it shrinks, and the app sets
  // the window's least as the text size changes, maybe after this lowered it (#1293): so it's set
  // again until the window is that wide.
  const css = Math.floor(width / zoom);
  await sizeWindow(width, 700, css);
  return css;
}

/**
 * Sizes the window's content to `width` × `height` until its page is `css` CSS px wide, within a
 * pixel (#1293): a resize can be undone by the app's own least for the text size, set as that
 * changes, or not have landed yet, so it's set again until it holds.
 */
async function sizeWindow(width: number, height: number, css: number): Promise<void> {
  await expect(async () => {
    await app.evaluate(
      ({ BrowserWindow }, size) => {
        const main = BrowserWindow.getAllWindows()[0];
        main?.setMinimumSize(600, 400);
        main?.setContentSize(size.width, size.height);
      },
      { width, height },
    );
    const inner = await page.evaluate(() => window.innerWidth);
    expect(Math.abs(inner - css)).toBeLessThanOrEqual(1);
  }).toPass();
}

for (const [zoom, screen] of [
  [1.1, 1280],
  [1.25, 1280],
  [1.5, 1280],
  [1.25, 1024],
] as const) {
  test(`fits the title bar at ${Math.round(zoom * 100)}% text size on a ${screen} px screen (#1195)`, async () => {
    const css = await atTextSize(zoom, screen);
    const banner = page.getByRole("banner");
    for (const count of ["99 to fix", "99 tips", "No problems"]) {
      await expectTitleBarFits(count, css);
    }
    // Their words still: Design | Content, Site Check's count and Publish.
    await expect(banner.getByRole("radio", { name: "Design" })).toHaveText("Design");
    await expect(banner.getByRole("button", { name: "Publish" })).toHaveText("Publish");
  });
}

test("folds the panel buttons into one Panels menu in a narrow title bar, ticked as shown (#1195)", async () => {
  await atTextSize(1.5, 1280);
  const banner = page.getByRole("banner");
  // New and Open are in the Menu's File only, and the save status is its tick.
  await expect(banner.getByRole("button", { name: /^New Site/ })).toBeHidden();
  await expect(banner.getByRole("status")).toHaveAttribute("data-status", "saved");
  await expect(banner.getByRole("status")).toHaveText("Saved");

  await expect(banner.getByRole("button", { name: "Show or Hide Left Panels" })).toBeHidden();
  await banner.getByRole("button", { name: "Show or hide panels" }).click();
  const bottom = page.getByRole("menuitemcheckbox", { name: /^Bottom Panel/ });
  await expect(bottom).toHaveAttribute("aria-checked", "false");
  await bottom.click();
  await expect(page.getByRole("region", { name: "Bottom panel" })).toBeVisible();
  await banner.getByRole("button", { name: "Show or hide panels" }).click();
  await expect(page.getByRole("menuitemcheckbox", { name: /^Bottom Panel/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.keyboard.press("Escape");
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

/** Checks {@link titleBarWith} `count`: nothing over or cut off, and `spare` px or more to spare. */
async function expectTitleBarFits(count: string, width: number, spare = 4): Promise<void> {
  // Measured again until it settles: on Linux, the window controls' overlay reports the title
  // bar's room for the window's size before a resize for a moment after it.
  await expect(async () => {
    const layout = await titleBarWith(count);
    console.log(
      `[work] ${width} px title bar, "${count}": Publish ends at ${layout.publishRight.toFixed(1)} of ${layout.room} px, ${(layout.searchWidth - 140).toFixed(1)} px to spare`,
    );
    expect(layout.overlaps, count).toEqual([]);
    expect(layout.cutOff, count).toBe(false);
    // Half a pixel for the zoom's rounding (#1195).
    expect(layout.publishRight, count).toBeLessThanOrEqual(layout.room + 0.5);
    // The spare is what the search box has over its least, 140 px.
    expect(layout.searchWidth - 140, count).toBeGreaterThanOrEqual(spare);
  }).toPass({ timeout: 5_000 });
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
    .getByRole("button", { name: "Add" })
    .click();
  await expectLeftOpen();
});

test("opens the left column from its strip's own button, folding the right (#1412)", async () => {
  await page
    .getByRole("navigation", { name: "Left panels, collapsed" })
    .getByRole("button", { name: "Show Left Panels" })
    .click();
  await expectLeftOpen();
});
