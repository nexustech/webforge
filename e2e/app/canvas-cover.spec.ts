import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import {
  APP_START_TIMEOUT_MS,
  launchDesktopApp,
  removeWhenFree,
  type WebforgeApp,
  waitForCanvas,
} from "./launch.js";
import { stubFileDialogs } from "./sites.js";

// The canvas's cover (#1013): a site's markup is drawn before its compiled CSS arrives, and it
// looked broken for about 2 s on opening. From the moment the canvas has content, every frame
// shows either the site with its CSS or the cover over it.

let dir: string;
let app: WebforgeApp | undefined;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-canvas-cover-"));
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  void removeWhenFree(dir);
});

/** What the editor window's watch saw, frame by frame, since it loaded. */
type Watch = { readonly sampled: number; readonly unstyled: number };

/**
 * Watches every frame of each page the editor's window loads: one with the canvas's site content
 * shown, neither styled nor covered, counts as unstyled.
 */
function watchCanvas() {
  if (window.top !== window) return;
  const watch = { sampled: 0, unstyled: 0 };
  Object.assign(window, { canvasWatch: watch });
  const sample = () => {
    const frame = document.querySelector<HTMLIFrameElement>(".editor__canvas iframe");
    const body = frame?.contentDocument?.body;
    if (body !== undefined && body !== null && (body.textContent ?? "").trim() !== "") {
      watch.sampled += 1;
      const styled = frame?.contentDocument?.querySelector("style[data-webforge-site-css]");
      const covered = document.querySelector(".editor__canvas-cover") !== null;
      if ((styled === null || styled === undefined) && !covered) watch.unstyled += 1;
    }
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
}

/**
 * Holds main's answer to the canvas's CSS by `ms`, as a cold, busy machine's first compile is held
 * (#1013: 2 s and more), so the page's markup is drawn well before its styles come. Through
 * Electron's own table of `ipcMain.handle` handlers: nothing in the app is there for the test.
 */
async function holdCanvasCss(app: WebforgeApp, ms: number): Promise<void> {
  await app.evaluate(({ ipcMain }, hold) => {
    type Handler = (...args: unknown[]) => unknown;
    const handlers = (ipcMain as unknown as { _invokeHandlers?: Map<string, Handler> })
      ._invokeHandlers;
    const compile = handlers?.get("canvas:compile-css");
    if (handlers === undefined || compile === undefined) {
      throw new Error("Electron's table of handlers has changed: hold the CSS another way");
    }
    handlers.set("canvas:compile-css", async (...args: unknown[]) => {
      await new Promise((resolve) => setTimeout(resolve, hold));
      return compile(...args);
    });
  }, ms);
}

const watched = (page: Page) =>
  page.evaluate(() => (window as unknown as { canvasWatch: Watch }).canvasWatch);

test("never shows a site's page unstyled, as it's created or opened again", async () => {
  app = await launchDesktopApp({ userDataDir: join(dir, "user-data"), site: false });
  const page = await app.firstWindow();
  await expect(page.getByRole("heading", { name: "Get started" })).toBeVisible({
    timeout: APP_START_TIMEOUT_MS,
  });
  await stubFileDialogs(app, join(dir, "Rosa's Bakery.wforge"));
  // For the window as it starts over with the new site, and each time it loads again.
  await app.context().addInitScript(watchCanvas);
  await holdCanvasCss(app, 2_000);

  // The Café template: a photo at full size, and a menu as a bulleted list, unstyled.
  await page.getByRole("button", { name: "Start a Site…", exact: true }).click();
  const quickStart = page.getByRole("dialog", { name: "Start a site" });
  await quickStart.getByRole("radio", { name: "Food and drink" }).click();
  await quickStart.getByRole("textbox", { name: "Business or site name" }).fill("Rosa's Bakery");
  await quickStart.getByRole("button", { name: "Create site" }).click();

  await waitForCanvas(page);
  await expect(page.locator(".editor__canvas-cover")).toHaveCount(0);
  const created = await watched(page);
  expect(created.sampled).toBeGreaterThan(0);
  expect(created.unstyled).toBe(0);

  // Opened again: the window loads the site afresh.
  await page.reload();
  await waitForCanvas(page);
  await expect(page.locator(".editor__canvas-cover")).toHaveCount(0);
  const reopened = await watched(page);
  expect(reopened.sampled).toBeGreaterThan(0);
  expect(reopened.unstyled).toBe(0);
});
