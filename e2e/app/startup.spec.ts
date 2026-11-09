import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
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

/** The start-up screen's indeterminate bar, named by its label. */
const startupScreen = (page: Page) =>
  page.getByRole("progressbar", { name: "Starting Webforge…", exact: true });

/** The site's home page on the canvas: the editor has started. */
const homePage = (page: Page) =>
  page.frameLocator(".editor__canvas iframe").locator("h1", { hasText: STARTER_HEADING });

/**
 * How main answers the editor's state (`project:get-ui-state`, one of the reads the editor starts
 * with) from now on: never (start-up takes as long as the test likes), with an error (as for a file
 * that went away), or with none (the site's editor state starts afresh).
 */
async function answerEditorState(
  electronApp: ElectronApplication,
  answer: "never" | "error" | "none",
): Promise<void> {
  await electronApp.evaluate(
    ({ ipcMain }, { channel, answer }) => {
      ipcMain.removeHandler(channel);
      ipcMain.handle(channel, () => {
        if (answer === "never") return new Promise(() => undefined);
        if (answer === "error") throw new Error("E2E: the editor's state can't be read");
        return null;
      });
    },
    { channel: "project:get-ui-state", answer },
  );
}

test("starts in the person's theme, with the start-up screen's words from i18n", async () => {
  app = await launchInLightTheme();
  const page = await app.firstWindow();

  // The theme in its address, the words filled in at build time, the classic script served.
  expect(new URL(page.url()).searchParams.get("theme")).toBe("light");
  const served = await page.evaluate(async () => (await fetch(window.location.href)).text());
  expect(served).toContain("Starting Webforge…");
  expect(served).not.toMatch(/%WEBFORGE_[A-Z_]+%/);
  const script = await page.evaluate(async () => (await fetch("/startup-theme.js")).status);
  expect(script).toBe(200);

  await expect(homePage(page)).toBeVisible({ timeout: APP_START_TIMEOUT_MS });
  await expect(startupScreen(page)).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("shows the start-up screen while starting, then Try again if starting fails", async () => {
  app = await launchInLightTheme();
  const page = await app.firstWindow();
  await expect(homePage(page)).toBeVisible({ timeout: APP_START_TIMEOUT_MS });

  // A start that hasn't finished: the start-up screen, in the light theme, title bar and all.
  await answerEditorState(app, "never");
  await page.reload();
  await expect(startupScreen(page)).toBeVisible({ timeout: APP_START_TIMEOUT_MS });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  // The light theme's --titlebar (#d4d8de), as the editor's own title bar has it.
  await expect(page.locator(".startup__title-bar")).toHaveCSS(
    "background-color",
    "rgb(212, 216, 222)",
  );

  // A start that fails: what went wrong and Try again, never the start-up screen left up.
  await answerEditorState(app, "error");
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "Something went wrong starting Webforge. Your work is saved.",
    { timeout: APP_START_TIMEOUT_MS },
  );
  await expect(startupScreen(page)).toHaveCount(0);

  // Once the read works again, Try again starts the editor.
  await answerEditorState(app, "none");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(homePage(page)).toBeVisible({ timeout: APP_START_TIMEOUT_MS });
});
