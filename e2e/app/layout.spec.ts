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
}

test.beforeAll(start);

test.afterAll(async () => {
  await app.close();
  rmSync(userDataDir, { recursive: true, force: true });
});

const leftWidth = async () =>
  (await page.getByRole("region", { name: "Left panels" }).boundingBox())?.width ?? 0;

const savedPreferences = (): { panelLayout?: Record<string, unknown>; theme?: string } => {
  const file = join(userDataDir, "preferences.json");
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
};

test.describe("window layout", () => {
  test("puts Undo History in the left column, under an empty Add slot", async () => {
    const left = page.getByRole("region", { name: "Left panels" });
    await expect(left.getByRole("tab", { name: "Undo History" })).toBeVisible();
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

  test("hides and shows the left panels from the title bar", async () => {
    const toggle = page.getByRole("button", { name: "Show or Hide Left Panels" });
    await toggle.click();
    await expect.poll(leftWidth).toBeLessThan(2);
    await toggle.click();
    await expect.poll(leftWidth).toBeGreaterThan(150);
  });

  test("switches to the light theme and remembers it", async () => {
    await page.getByRole("menuitem", { name: "View" }).click();
    await page.getByRole("menuitem", { name: "Use Light Theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect.poll(() => savedPreferences().theme).toBe("light");

    await app.close();
    await start();

    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
});
