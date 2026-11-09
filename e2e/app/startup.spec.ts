import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { APP_START_TIMEOUT_MS, launchDesktopApp, type WebforgeApp } from "./launch.js";

// The start-up screen (#887): drawn in the person's theme while the editor loads, replaced by the
// editor, and by a way to try again if starting fails, never left up.

/** The site's home page's heading: the Blank template's (2.15c). */
const STARTER_HEADING = "Welcome";

let dir: string;
let app: WebforgeApp | undefined;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-startup-"));
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

/** Launches the app for someone in the light theme, which the start-up screen must be drawn in. */
async function launchInLightTheme(): Promise<WebforgeApp> {
  const userDataDir = join(dir, "user-data");
  mkdirSync(userDataDir, { recursive: true });
  writeFileSync(
    join(userDataDir, "preferences.json"),
    JSON.stringify({
      theme: "light",
      onboarding: { tour: "new", tipsSeen: [], showTips: false },
    }),
  );
  return launchDesktopApp({ userDataDir });
}

test("draws the start-up screen in the person's theme, then the editor replaces it", async () => {
  app = await launchInLightTheme();
  const page = await app.firstWindow();

  // The page as the window loads it: the theme in its address, the screen in its markup, its words
  // filled in at build time.
  expect(new URL(page.url()).searchParams.get("theme")).toBe("light");
  const served = await page.evaluate(async () => (await fetch(window.location.href)).text());
  expect(served).toContain('data-testid="startup"');
  expect(served).toContain("Starting Webforge…");
  expect(served).not.toMatch(/%WEBFORGE_[A-Z_]+%/);
  // The classic script the screen's theme comes from loads (the app's scheme serves it).
  const script = await page.evaluate(async () => (await fetch("/startup-theme.js")).status);
  expect(script).toBe(200);

  await expect(
    page.frameLocator(".editor__canvas iframe").locator("h1", { hasText: STARTER_HEADING }),
  ).toBeVisible({ timeout: APP_START_TIMEOUT_MS });
  await expect(page.getByTestId("startup")).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("says starting failed, with Try again, rather than staying on the start-up screen", async () => {
  app = await launchInLightTheme();
  const page = await app.firstWindow();
  await expect(
    page.frameLocator(".editor__canvas iframe").locator("h1", { hasText: STARTER_HEADING }),
  ).toBeVisible({ timeout: APP_START_TIMEOUT_MS });

  // The editor's state can't be read on the next start: as a damaged or vanished file would fail.
  const channel = "project:get-ui-state";
  const original = await app.evaluate(({ ipcMain }, name) => {
    const handlers = (ipcMain as unknown as { _invokeHandlers: Map<string, unknown> })
      ._invokeHandlers;
    const kept = handlers.get(name);
    (globalThis as { __keptHandler?: unknown }).__keptHandler = kept;
    ipcMain.removeHandler(name);
    ipcMain.handle(name, () => {
      throw new Error("E2E: the editor's state can't be read");
    });
    return kept !== undefined;
  }, channel);
  expect(original).toBe(true);
  await page.reload();

  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Something went wrong starting Webforge. Your work is saved.", {
    timeout: APP_START_TIMEOUT_MS,
  });
  await expect(page.getByTestId("startup")).toHaveCount(0);

  // Once it can be read again, Try again starts the editor.
  await app.evaluate(({ ipcMain }, name) => {
    const kept = (globalThis as { __keptHandler?: Parameters<typeof ipcMain.handle>[1] })
      .__keptHandler;
    ipcMain.removeHandler(name);
    if (kept !== undefined) ipcMain.handle(name, kept);
  }, channel);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.frameLocator(".editor__canvas iframe").locator("h1", { hasText: STARTER_HEADING }),
  ).toBeVisible({ timeout: APP_START_TIMEOUT_MS });
});
