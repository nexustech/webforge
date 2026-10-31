import { existsSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { APP_START_TIMEOUT_MS, launchDesktopApp, newUserDataDir } from "./launch.js";

// A roomy canvas (ADR 0008): the window starts maximised and remembers how it was left, side
// columns are narrow and show one panel at a time, and the canvas stays usable at 1280 px.

const userDataDir = newUserDataDir();
let app: ElectronApplication;
let page: Page;

async function start(): Promise<void> {
  app = await launchDesktopApp({ userDataDir });
  page = await app.firstWindow();
  await expect(page.getByRole("region", { name: "Left panels" })).toBeVisible({
    timeout: APP_START_TIMEOUT_MS,
  });
}

test.beforeAll(start);

test.afterAll(async () => {
  await app.close();
  await rm(userDataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

const isMaximized = () =>
  app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isMaximized() ?? false);

const savedWindow = (): { maximized?: boolean; bounds?: { width: number } } | null => {
  const file = join(userDataDir, "preferences.json");
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")).window ?? null) : null;
};

const widthOf = async (selector: string) =>
  (await page.locator(selector).boundingBox())?.width ?? 0;

test.describe("window and canvas size", () => {
  test("starts maximised", async () => {
    // Without a window manager (Linux CI's virtual display) a window can't be maximised.
    test.skip(process.platform === "linux", "maximising needs a window manager");
    await expect.poll(isMaximized).toBe(true);
  });

  test("shows one panel per side column, in a narrow column", async () => {
    for (const name of ["Left panels", "Right panels"]) {
      const column = page.getByRole("region", { name });
      if ((await column.count()) === 0) {
        continue;
      }
      // The column's own tab panel, not those of a panel's own tabs (Add's Sections, Elements).
      await expect(
        column.locator('[data-slot="tabs"]').first().locator(':scope > [role="tabpanel"]:visible'),
      ).toHaveCount(1);
      const width = (await column.boundingBox())?.width ?? 0;
      expect(width).toBeGreaterThan(190);
      expect(width).toBeLessThan(370);
    }
  });

  test("keeps the canvas usable in a 1280 × 800 window, and remembers that size", async () => {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.unmaximize());
    await expect.poll(isMaximized).toBe(false);
    await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      window?.setBounds({ x: 40, y: 40, width: 1280, height: 800 });
      // Programmatic changes don't report "resized"; the person's do.
      window?.emit("resized");
    });
    await expect.poll(() => widthOf(".editor__canvas")).toBeGreaterThan(760);
    await expect.poll(() => savedWindow()?.bounds?.width).toBe(1280);
    expect(savedWindow()?.maximized).toBe(false);

    await app.close();
    await start();

    expect(await isMaximized()).toBe(false);
    const width = await app.evaluate(
      ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getBounds().width,
    );
    expect(width).toBe(1280);
  });
});
