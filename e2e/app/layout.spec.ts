import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import {
  APP_START_TIMEOUT_MS,
  launchDesktopApp,
  newUserDataDir,
  removeWhenFree,
  waitForCanvas,
} from "./launch.js";
import { chooseFromMenu } from "./menus.js";

// The window shell (1.2): panel sizes and the theme are remembered per person, across restarts.

const userDataDir = newUserDataDir();
let app: ElectronApplication;
let page: Page;

async function start(): Promise<void> {
  app = await launchDesktopApp({ userDataDir });
  page = await app.firstWindow();
  await expect(page.getByRole("region", { name: "Left panels" })).toBeVisible({
    timeout: APP_START_TIMEOUT_MS,
  });
  // The canvas takes the focus once its page has loaded, which closes a menu opened before then.
  await waitForCanvas(page);
  await expect(page.frameLocator(".editor__canvas iframe").locator("h1")).toBeVisible();
}

test.beforeAll(start);

test.afterAll(async () => {
  await app.close();
  void removeWhenFree(userDataDir);
});

/**
 * Runs a View menu command, once a menu an earlier one closed has gone: while it's still closing,
 * "View" also matches its items ("Desktop View").
 */
async function viewMenu(name: string): Promise<void> {
  await expect(page.getByRole("menu")).toHaveCount(0);
  await chooseFromMenu(app, page, "View", name);
}

/** The left column's width; a collapsed one hides its panels (it shows a strip of icons). */
const leftWidth = async () => {
  const left = page.getByRole("region", { name: "Left panels" });
  if (!(await left.isVisible())) return 0;
  // Hidden just after the check, as the column collapses: don't wait for it to come back.
  return (await left.boundingBox({ timeout: 250 }).catch(() => null))?.width ?? 0;
};

const savedPreferences = (): { panelLayout?: Record<string, unknown>; theme?: string } => {
  const file = join(userDataDir, "preferences.json");
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
};

test.describe("window layout", () => {
  test("puts Add, then Undo History, Version History and the Assistant, in the left column", async () => {
    const left = page.getByRole("region", { name: "Left panels" });
    // The column's own tabs, not the Add panel's Sections and Elements: icons, named by their
    // panels' titles (#898).
    const tabs = left.getByRole("tablist").first().getByRole("tab");
    await expect(tabs).toHaveCount(4);
    for (const [at, name] of ["Add", "Undo History", "Version History", "Assistant"].entries()) {
      await expect(tabs.nth(at)).toHaveAccessibleName(name);
      await expect(tabs.nth(at)).toHaveText("");
    }
    await expect(left.getByRole("tab", { name: "Add" })).toHaveAttribute("aria-selected", "true");
    await left.getByRole("tab", { name: "Undo History" }).click();
    await expect(left.getByText("Opened page")).toBeVisible();
  });

  test("keeps a resized column's width after a restart", async () => {
    const before = await leftWidth();
    const separator = page.getByRole("separator", { name: "Resize the left panels", exact: true });
    await separator.focus();
    for (let step = 0; step < 5; step += 1) {
      await page.keyboard.press("ArrowRight");
    }
    await expect.poll(leftWidth).toBeGreaterThan(before + 20);
    const resized = await leftWidth();
    await expect.poll(() => savedPreferences().panelLayout?.["shell.columns"]).toBeDefined();

    await app.close();
    await start();

    await expect.poll(leftWidth).toBeGreaterThan(resized - 3);
    expect(await leftWidth()).toBeLessThan(resized + 3);
  });

  test("keeps Layers' share of the left column after a restart; Reset Panels gives 60/40 back", async () => {
    // Layers' part of the left column's height, under the tabs (ADR 0011).
    const share = async () => {
      const tabs = await page.locator('[data-panel][id="tabs"]').boundingBox();
      const lower = await page.locator('[data-panel][id="lower"]').boundingBox();
      return tabs === null || lower === null ? 0 : lower.height / (tabs.height + lower.height);
    };
    await expect.poll(share).toBeCloseTo(0.4, 1);
    await page.getByRole("separator", { name: "Resize Layers", exact: true }).focus();
    for (let step = 0; step < 10; step += 1) {
      await page.keyboard.press("ArrowUp");
    }
    await expect.poll(share).toBeGreaterThan(0.45);
    const resized = await share();
    await expect.poll(() => savedPreferences().panelLayout?.["shell.left"]).toBeDefined();

    await app.close();
    await start();

    await expect.poll(share).toBeCloseTo(resized, 2);
    await viewMenu("Reset Panels");
    await expect.poll(share).toBeCloseTo(0.4, 2);
  });

  test("hides and shows the left panels from the title bar", async () => {
    const toggle = page.getByRole("button", { name: "Show or Hide Left Panels" });
    await toggle.click();
    await expect.poll(leftWidth).toBeLessThan(2);
    await toggle.click();
    await expect.poll(leftWidth).toBeGreaterThan(150);
  });

  test("leaves a strip of panel icons when a column is collapsed, which opens it at a panel (UX-13)", async () => {
    const toggle = page.getByRole("button", { name: "Show or Hide Left Panels" });
    await toggle.click();
    const strip = page.getByRole("navigation", { name: "Left panels, collapsed" });
    // Its own button that opens it (#1412), then the panels' icons: Layers too, from the column's
    // lower pane (ADR 0011), and the Assistant (6.9c).
    await expect(strip.getByRole("button")).toHaveText(["", "", "", "", "", ""]);
    await expect(strip.getByRole("button").first()).toHaveAccessibleName("Show Left Panels");
    await expect(strip.getByRole("button", { name: "Add" })).toBeVisible();
    await expect(strip.getByRole("button", { name: "Layers" })).toBeVisible();

    await strip.getByRole("button", { name: "Undo History" }).click();

    await expect(strip).toHaveCount(0);
    const left = page.getByRole("region", { name: "Left panels" });
    await expect(left.getByRole("tab", { name: "Undo History" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect.poll(leftWidth).toBeGreaterThan(150);
  });

  test("collapses each part from its own button and opens it again where it was (#1412)", async () => {
    const left = page.getByRole("region", { name: "Left panels" });
    await left.getByRole("tab", { name: "Version History" }).click();
    await left.getByRole("button", { name: "Hide Left Panels" }).click();
    await expect.poll(leftWidth).toBeLessThan(2);

    // The strip's button opens the column on the panel it last showed.
    await page
      .getByRole("navigation", { name: "Left panels, collapsed" })
      .getByRole("button", { name: "Show Left Panels" })
      .click();
    await expect.poll(leftWidth).toBeGreaterThan(150);
    await expect(left.getByRole("tab", { name: "Version History" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await left.getByRole("tab", { name: "Add" }).click();

    // From the keyboard: the focus goes to the button that undoes the one pressed, which went
    // with its part or its strip.
    const right = page.getByRole("region", { name: "Right panels" });
    const hideRight = right.getByRole("button", { name: "Hide Right Panels" });
    await hideRight.focus();
    await page.keyboard.press("Enter");
    await expect(right).toBeHidden();
    const showRight = page
      .getByRole("navigation", { name: "Right panels, collapsed" })
      .getByRole("button", { name: "Show Right Panels" });
    await expect(showRight).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(right).toBeVisible();
    await expect(hideRight).toBeFocused();

    // The bottom panel: a bar while it's collapsed, its button at the end of its tabs when open.
    const bottom = page.getByRole("region", { name: "Bottom panel" });
    const bar = page.getByRole("navigation", { name: "Bottom panel, collapsed" });
    await expect(bottom).toBeHidden();
    await bar.getByRole("button", { name: "Show Bottom Panel" }).click();
    await expect(bottom).toBeVisible();
    await expect(bar).toHaveCount(0);
    await expect(bottom.getByRole("button", { name: "Hide Bottom Panel" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(bottom).toBeHidden();
    await expect(bar.getByRole("button", { name: "Show Bottom Panel" })).toBeFocused();
  });

  test("hides and shows the right panels with Ctrl+Alt+Shift+B (#1412)", async () => {
    const right = page.getByRole("region", { name: "Right panels" });
    await expect(right).toBeVisible();
    await page.keyboard.press("ControlOrMeta+Alt+Shift+B");
    await expect(right).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Right panels, collapsed" })).toBeVisible();
    await page.keyboard.press("ControlOrMeta+Alt+Shift+B");
    await expect(right).toBeVisible();
    // The left panels keep their own key.
    await expect(page.getByRole("region", { name: "Left panels" })).toBeVisible();
  });

  test("switches to the light theme and remembers it", async () => {
    await viewMenu("Use Light Appearance");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect.poll(() => savedPreferences().theme).toBe("light");

    await app.close();
    await start();

    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
});
