import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, newUserDataDir } from "./launch.js";

// The window shell (1.2): panel sizes and the theme are remembered per person, across restarts.

const userDataDir = newUserDataDir();
let app: ElectronApplication;
let page: Page;

async function start(): Promise<void> {
  app = await launchDesktopApp({ userDataDir });
  page = await app.firstWindow();
  await expect(page.getByRole("region", { name: "Left panels" })).toBeVisible();
  // The canvas takes the focus once its page has loaded, which closes a menu opened before then.
  await expect(page.frameLocator(".editor__canvas iframe").locator("h1")).toBeVisible();
}

test.beforeAll(start);

test.afterAll(async () => {
  await app.close();
  rmSync(userDataDir, { recursive: true, force: true });
});

/**
 * Runs a View menu command, once a menu an earlier one closed has gone: while it's still closing,
 * "View" also matches its items ("Desktop View").
 */
async function viewMenu(name: string): Promise<void> {
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.getByRole("menuitem", { name: "View", exact: true }).click();
  await page.getByRole("menuitem", { name }).click();
}

/** The left column's width; a collapsed one hides its panels (it shows a strip of icons). */
const leftWidth = async () => {
  const left = page.getByRole("region", { name: "Left panels" });
  return (await left.isVisible()) ? ((await left.boundingBox())?.width ?? 0) : 0;
};

const savedPreferences = (): { panelLayout?: Record<string, unknown>; theme?: string } => {
  const file = join(userDataDir, "preferences.json");
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
};

test.describe("window layout", () => {
  test("puts Add, then Undo History, in the left column", async () => {
    const left = page.getByRole("region", { name: "Left panels" });
    // The column's own tabs, not the Add panel's Sections and Elements.
    await expect(left.getByRole("tablist").first().getByRole("tab")).toHaveText([
      "Add",
      "Undo History",
    ]);
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
    // The last test's View menu gone first: a click while it closes only dismisses it.
    await expect(page.getByRole("menu")).toHaveCount(0);
    await toggle.click();
    await expect.poll(leftWidth).toBeLessThan(2);
    await toggle.click();
    await expect.poll(leftWidth).toBeGreaterThan(150);
  });

  test("leaves a strip of panel icons when a column is collapsed, which opens it at a panel (UX-13)", async () => {
    const toggle = page.getByRole("button", { name: "Show or Hide Left Panels" });
    await toggle.click();
    const strip = page.getByRole("navigation", { name: "Left panels, collapsed" });
    // Layers too, from the column's lower pane (ADR 0011).
    await expect(strip.getByRole("button")).toHaveText(["", "", ""]);
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

  test("switches to the light theme and remembers it", async () => {
    await viewMenu("Use Light Theme");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect.poll(() => savedPreferences().theme).toBe("light");

    await app.close();
    await start();

    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
});
