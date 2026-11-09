import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { APP_START_TIMEOUT_MS, launchDesktopApp, type WebforgeApp } from "./launch.js";

// The start-up screen (#887): drawn in the person's theme while the editor loads, replaced by the
// editor, and by a way to try again if starting fails, never left up. The editor's code loads only
// with a site open (#896).

/** The site's home page's heading: the Blank template's (2.15c). */
const STARTER_HEADING = "Welcome";

let dir: string;
let app: WebforgeApp | undefined;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-startup-"));
});

test.afterEach(async () => {
  const testInfo = test.info();
  // A start that failed when it shouldn't have: the app's local crash reports, which give the
  // error's name and frames, never its message, show what failed (a read, or the editor's code).
  if (testInfo.status !== testInfo.expectedStatus) {
    const reports = join(dir, "user-data", "crash-reports");
    for (const name of existsSync(reports) ? readdirSync(reports) : []) {
      console.log(`Crash report ${name}:\n${readFileSync(join(reports, name), "utf8")}`);
    }
  }
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

/**
 * Puts a stand-in in front of the app's own files (`webforge-app://`): it serves them from the
 * build as main does, notes each script asked for (`appScripts`), and fails the editor's code
 * while `failEditorCode` says so, as a missing or damaged file would.
 */
async function standInForAppFiles(electronApp: ElectronApplication): Promise<void> {
  await electronApp.evaluate(({ app, session }) => {
    const { readFile } = process.getBuiltinModule("node:fs/promises");
    const { join } = process.getBuiltinModule("node:path");
    const types: Record<string, string> = {
      js: "text/javascript",
      css: "text/css",
      html: "text/html",
      svg: "image/svg+xml",
      png: "image/png",
      woff2: "font/woff2",
    };
    const state = { scripts: [] as string[], failEditor: false };
    Object.assign(globalThis, { e2eAppFiles: state });
    const scheme = session.defaultSession.protocol;
    scheme.unhandle("webforge-app");
    scheme.handle("webforge-app", async (request) => {
      const name = new URL(request.url).pathname.slice(1);
      const ending = name.split(".").at(-1) ?? "";
      if (ending === "js") state.scripts.push(name.split("/").at(-1) ?? name);
      if (state.failEditor && /^assets\/editor-start-[\w-]+\.js$/.test(name)) {
        return new Response(null, { status: 404 });
      }
      try {
        const data = await readFile(join(app.getAppPath(), "out/renderer", name));
        return new Response(new Uint8Array(data), {
          headers: { "content-type": types[ending] ?? "application/octet-stream" },
        });
      } catch {
        return new Response(null, { status: 404 });
      }
    });
  });
}

/**
 * Loads `page` again with nothing from before: a reload takes the scripts it has already loaded
 * from memory, so the stand-in would never see them asked for. Its cache stays off afterwards.
 */
async function reloadAfresh(page: Page): Promise<void> {
  const devTools = await page.context().newCDPSession(page);
  await devTools.send("Network.enable");
  await devTools.send("Network.setCacheDisabled", { cacheDisabled: true });
  await page.reload();
}

type AppFiles = { scripts: string[]; failEditor: boolean };

/** The scripts the window has asked for since the stand-in went in, by file name. */
const appScripts = (electronApp: ElectronApplication) =>
  electronApp.evaluate(
    () => (globalThis as unknown as { e2eAppFiles: AppFiles }).e2eAppFiles.scripts,
  );

/** Makes every load of the editor's code fail from now on, or lets it load again (`false`). */
const failEditorCode = (electronApp: ElectronApplication, fail: boolean) =>
  electronApp.evaluate((_electron, fail) => {
    (globalThis as unknown as { e2eAppFiles: AppFiles }).e2eAppFiles.failEditor = fail;
  }, fail);

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

test("the start screen loads none of the editor's code, which a site's editor loads (#896)", async () => {
  app = await launchDesktopApp({ userDataDir: join(dir, "user-data"), site: false });
  const page = await app.firstWindow();
  const getStarted = page.getByRole("heading", { name: "Get started" });
  await expect(getStarted).toBeVisible({ timeout: APP_START_TIMEOUT_MS });
  // Loaded again with the stand-in noting what it asks for.
  await standInForAppFiles(app);
  await reloadAfresh(page);
  await expect(getStarted).toBeVisible({ timeout: APP_START_TIMEOUT_MS });
  const atStart = await appScripts(app);
  expect(atStart.some((name) => name.startsWith("index-"))).toBe(true);
  expect(atStart.filter((name) => name.startsWith("editor-start-"))).toEqual([]);
  await app.close();

  app = await launchInLightTheme();
  const editor = await app.firstWindow();
  await expect(homePage(editor)).toBeVisible({ timeout: APP_START_TIMEOUT_MS });
  await standInForAppFiles(app);
  await reloadAfresh(editor);
  await expect(homePage(editor)).toBeVisible({ timeout: APP_START_TIMEOUT_MS });
  expect((await appScripts(app)).some((name) => name.startsWith("editor-start-"))).toBe(true);
});

test("Try again, never the start-up screen, when the editor's code doesn't load (#896)", async () => {
  app = await launchInLightTheme();
  const page = await app.firstWindow();
  await expect(homePage(page)).toBeVisible({ timeout: APP_START_TIMEOUT_MS });

  await standInForAppFiles(app);
  await failEditorCode(app, true);
  await reloadAfresh(page);
  await expect(page.getByRole("alert")).toContainText(
    "Something went wrong starting Webforge. Your work is saved.",
    { timeout: APP_START_TIMEOUT_MS },
  );
  await expect(startupScreen(page)).toHaveCount(0);
  expect((await appScripts(app)).some((name) => name.startsWith("editor-start-"))).toBe(true);

  // Once it loads again, Try again starts the editor.
  await failEditorCode(app, false);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(homePage(page)).toBeVisible({ timeout: APP_START_TIMEOUT_MS });
});
