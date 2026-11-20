import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { launchDesktopApp, type WebforgeApp, waitForCanvas } from "./launch.js";

// The editor's appearance follows the computer's light or dark setting by default (#1169), as it
// changes, without a restart; the computer's setting is Chromium's `prefers-color-scheme`, which
// Playwright emulates.

let app: WebforgeApp | undefined;
let dir: string;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-appearance-"));
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

/** Launches the app for someone with `theme` as their appearance, as a new install has it. */
async function launchWith(theme: "system" | "dark"): Promise<WebforgeApp> {
  const userDataDir = join(dir, "user-data");
  mkdirSync(userDataDir, { recursive: true });
  writeFileSync(
    join(userDataDir, "preferences.json"),
    JSON.stringify({ theme, onboarding: { tour: "new", tipsSeen: [], showTips: false } }),
  );
  return launchDesktopApp({ userDataDir });
}

test("follows the computer's light or dark setting as it changes (#1169)", async () => {
  app = await launchWith("system");
  const page = await app.firstWindow();
  await waitForCanvas(page);
  const html = page.locator("html");

  await page.emulateMedia({ colorScheme: "dark" });
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(html).toHaveAttribute("data-theme", "light");
});

test("keeps Dark, chosen before, whatever the computer's setting (#1169)", async () => {
  app = await launchWith("dark");
  const page = await app.firstWindow();
  await waitForCanvas(page);

  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
