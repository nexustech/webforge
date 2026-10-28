import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { ProjectStore } from "@webforge/storage";
import { placeCaret } from "./caret.js";
import { largeSiteEdits } from "./large-site.js";
import { launchDesktopApp, type WebforgeApp, waitForCanvas } from "./launch.js";
import type { RendererWindow } from "./sites.js";

// Periodic autosave (P2, F-SITE-3): the site is saved about 2 s after editing pauses and when the
// window closes, so a crash loses at most the last few seconds.

const STARTER_HEADING = "Welcome to our business";

let dir: string;
let sitePath: string;
let app: WebforgeApp | undefined;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-autosave-"));
  sitePath = join(dir, "Autosave.wforge");
  // A new, empty site, as the start screen will create one (1.8).
  ProjectStore.create(sitePath, { name: "Autosave" }).close();
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

/**
 * Ends the app abruptly, as a crash or a power cut would: no close handlers, no last save. The
 * whole process tree goes, so no orphaned renderer keeps the site folder busy on Windows.
 */
async function killApp(): Promise<void> {
  const child = app?.process();
  const closed = app?.waitForEvent("close").catch(() => undefined);
  if (child?.pid !== undefined && process.platform === "win32") {
    execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
  } else {
    child?.kill("SIGKILL");
  }
  await closed;
  app = undefined;
}

/** Closes the window as the user does (the title bar's close button), then waits for the app. */
async function closeWindow(): Promise<void> {
  // Once it has closed, not once Electron has torn its process down, which can take a minute (#534).
  const closed = app?.untilClosed();
  await app?.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.close();
  });
  await closed;
  app = undefined;
}

/** Starts Webforge with the site, as a double-click on the file does, and waits for the canvas. */
async function openSite(): Promise<Page> {
  app = await launchDesktopApp({ args: [sitePath] });
  const page = await app.firstWindow();
  // The first canvas render after a killed run can take a while on a busy machine. The site CSS
  // changes the layout when it arrives; clicks need the final positions.
  await waitForCanvas(page);
  return page;
}

const canvas = (page: Page) => page.frameLocator(".editor__canvas iframe");
const saveStatus = (page: Page) => page.getByRole("banner").getByRole("status");

/** Types `text` at the end of the starter heading, as a user editing it on the canvas. */
async function typeIntoHeading(page: Page, text: string): Promise<void> {
  const field = canvas(page).locator("h1 [contenteditable]");
  await field.hover();
  await expect(field).toHaveAttribute("contenteditable", "plaintext-only");
  await field.click();
  await placeCaret(field, "end");
  await page.keyboard.type(text, { delay: 20 });
  await expect(canvas(page).locator("h1")).toHaveText(`${STARTER_HEADING}${text}`);
}

test.describe("autosave", () => {
  test("writes a new site straight away and shows Saved", async () => {
    const page = await openSite();

    await expect(saveStatus(page)).toHaveText("Saved");
    await expect(canvas(page).locator("h1")).toHaveText(STARTER_HEADING);
  });

  test("keeps an edit when the app is killed 3 s later", async () => {
    let page = await openSite();
    await expect(saveStatus(page)).toHaveText("Saved");

    await typeIntoHeading(page, " today");
    await expect(saveStatus(page)).toHaveText("Saving…");
    const start = await page.evaluate(() => Date.now());
    await expect.poll(() => page.evaluate(() => Date.now())).toBeGreaterThan(start + 3_000);
    await killApp();

    page = await openSite();
    await expect(canvas(page).locator("h1")).toHaveText(`${STARTER_HEADING} today`);
  });

  test("saves the last edit when the window closes, without waiting for the pause", async () => {
    let page = await openSite();
    await expect(saveStatus(page)).toHaveText("Saved");

    await typeIntoHeading(page, "!");
    await closeWindow();

    page = await openSite();
    await expect(canvas(page).locator("h1")).toHaveText(`${STARTER_HEADING}!`);
  });

  test("Ctrl/Cmd+S saves now", async () => {
    const page = await openSite();
    await expect(saveStatus(page)).toHaveText("Saved");

    // Pressed while still typing on the canvas, where the habit kicks in.
    await typeIntoHeading(page, " now");
    await expect(saveStatus(page)).toHaveText("Saving…");
    // Through Electron's input pipeline, as a real key press arrives: Playwright's keyboard goes
    // straight to the page and skips the main process's before-input-event.
    await app?.evaluate(({ BrowserWindow }) => {
      const contents = BrowserWindow.getAllWindows()[0]?.webContents;
      const modifiers = [process.platform === "darwin" ? "meta" : "control"] as (
        | "meta"
        | "control"
      )[];
      contents?.sendInputEvent({ type: "keyDown", keyCode: "S", modifiers });
      contents?.sendInputEvent({ type: "keyUp", keyCode: "S", modifiers });
    });

    // Well before the 2 s pause would have saved it.
    await expect(saveStatus(page)).toHaveText("Saved", { timeout: 1_500 });
  });

  test("commits one changed page of a 225-node site at a time, each one saved", async () => {
    // How long such a commit takes is measured by `pnpm e2e:perf` (perf/commit.perf.ts, ADR 0007),
    // not here: on a shared runner, the first commits after the site opens wait for the renderer
    // drawing the page and the canvas CSS compiling, up to 480 ms against a few ms after (#338).
    const { site, changeLists, lastTitle } = largeSiteEdits(7);
    expect(changeLists.map((list) => list.length)).toEqual(changeLists.map(() => 1));
    const store = ProjectStore.open(sitePath);
    store.saveSite(site);
    store.close();
    const page = await openSite();
    await expect(saveStatus(page)).toHaveText("Saved");

    const statuses = await page.evaluate(
      async ({ changes }) => {
        const { project } = (window as unknown as RendererWindow).webforge;
        const sessionId = (await project.getCurrent())?.sessionId ?? "";
        const results: string[] = [];
        for (const list of changes) {
          results.push(((await project.commit(sessionId, list)) as { status: string }).status);
        }
        return results;
      },
      { changes: changeLists },
    );
    expect(statuses).toEqual(changeLists.map(() => "saved"));

    await closeWindow();
    const saved = ProjectStore.open(sitePath, { readOnly: true });
    expect(saved.readSite().pages[site.homePageId]?.title).toBe(lastTitle);
    saved.close();
  });
});
