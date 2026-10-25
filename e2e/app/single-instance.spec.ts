import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { ProjectStore } from "@webforge/storage";
import { placeCaret } from "./caret.js";
import { launchDesktopApp, launchSecondInstance, waitForCanvas } from "./launch.js";
import type { RendererWindow } from "./sites.js";

// One Webforge at a time (1.8, P1): a .wforge double-clicked while Webforge runs opens in the
// running window, after the open site is saved; quitting saves the last edit, then closes the file.

const STARTER_HEADING = "Welcome to our business";

let dir: string;
let userData: string;
let bakery: string;
let app: ElectronApplication | undefined;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-instance-"));
  userData = join(dir, "user-data");
  bakery = join(dir, "Bakery.wforge");
  ProjectStore.create(bakery, { name: "Bakery" }).close();
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

const canvas = (page: Page) => page.frameLocator(".editor__canvas iframe");

async function openBakery(): Promise<Page> {
  app = await launchDesktopApp({ args: [bakery], userDataDir: userData });
  const page = await app.firstWindow();
  await waitForCanvas(page);
  await expect(page.getByRole("banner").getByRole("status")).toHaveText("Saved");
  return page;
}

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

/** Whether the site file, read straight from disk, holds `text`. */
function fileContains(path: string, text: string): boolean {
  const store = ProjectStore.open(path, { readOnly: true });
  try {
    return JSON.stringify(store.readSite()).includes(text);
  } finally {
    store.close();
  }
}

/** The open site's file name, as the main process reports it to the renderer. */
const currentFile = (page: Page) =>
  page.evaluate(async () => {
    const current = await (window as unknown as RendererWindow).webforge.project.getCurrent();
    return current?.fileName;
  });

const windowCount = () =>
  app?.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);

test("opens a site double-clicked while Webforge runs in the same window, saving the open one", async () => {
  const page = await openBakery();
  await typeIntoHeading(page, " today");
  const florist = join(dir, "Florist.wforge");
  ProjectStore.create(florist, { name: "Florist" }).close();

  // The second launch hands the file over and quits at once, without a window of its own; the
  // running window starts over with the new site.
  const reloaded = page.waitForEvent("load");
  expect(await launchSecondInstance({ args: [florist], userDataDir: userData })).toBe(0);
  await reloaded;

  expect(await currentFile(page)).toBe("Florist.wforge");
  await expect(canvas(page).locator("h1")).toHaveText(STARTER_HEADING, { timeout: 30_000 });
  expect(await windowCount()).toBe(1);
  // Bakery was saved before Florist replaced it, and is closed: its file can be read.
  expect(fileContains(bakery, `${STARTER_HEADING} today`)).toBe(true);
});

test("a save still on its way when a double-clicked site replaces the open one never reaches it (R6)", async () => {
  const page = await openBakery();
  const bakerySession = await page.evaluate(
    async () =>
      (await (window as unknown as RendererWindow).webforge.project.getCurrent())?.sessionId,
  );
  const florist = join(dir, "Florist.wforge");
  ProjectStore.create(florist, { name: "Florist" }).close();

  const reloaded = page.waitForEvent("load");
  expect(await launchSecondInstance({ args: [florist], userDataDir: userData })).toBe(0);
  await reloaded;
  await expect(page.getByRole("banner").getByRole("status")).toHaveText("Saved", {
    timeout: 30_000,
  });

  // Bakery's renderer typed during the switch, and its save arrives only now: Florist's home page,
  // as Bakery's editor would send it, renamed.
  const late = await page.evaluate(async (sessionId) => {
    const api = (window as unknown as RendererWindow).webforge.project;
    const read = (await api.readSite()) as {
      site: { homePageId: string; pages: Record<string, { title: string }> };
    };
    const home = read.site.pages[read.site.homePageId];
    const changes = [
      {
        type: "put",
        id: `page:${read.site.homePageId}`,
        kind: "page",
        content: { ...home, title: "Typed in Bakery" },
      },
    ];
    return api.commit(sessionId ?? "", changes);
  }, bakerySession);

  expect(late).toEqual({ status: "failed", reason: "stale-session" });
  expect(await currentFile(page)).toBe("Florist.wforge");
  const florists = await page.evaluate(() =>
    (window as unknown as RendererWindow).webforge.project.readSite(),
  );
  expect(JSON.stringify(florists)).not.toContain("Typed in Bakery");
});

test("a second launch without a site, or with the open one, only brings the window forward", async () => {
  const page = await openBakery();
  // A mark on this page: a reload would clear it.
  await page.evaluate(() => Object.assign(window, { beforeHandOff: true }));

  expect(await launchSecondInstance({ args: [], userDataDir: userData })).toBe(0);
  expect(await launchSecondInstance({ args: [bakery], userDataDir: userData })).toBe(0);

  expect(await currentFile(page)).toBe("Bakery.wforge");
  expect(await windowCount()).toBe(1);
  expect(await page.evaluate(() => "beforeHandOff" in window)).toBe(true);
});

test("quitting saves the last edit, then closes the site file", async () => {
  const page = await openBakery();
  await typeIntoHeading(page, "!");

  const closed = app?.waitForEvent("close");
  // As Quit from the macOS app menu, Cmd+Q, or the OS ending the session would.
  await app?.evaluate(({ app: electronApp }) => {
    electronApp.quit();
  });
  await closed;
  app = undefined;

  expect(fileContains(bakery, `${STARTER_HEADING}!`)).toBe(true);
  // DELETE journal mode leaves no journal behind once the store is closed (ADR 0003).
  expect(existsSync(`${bakery}-journal`)).toBe(false);
});

test("a launch just after quitting opens Webforge, not the Webforge still ending (#413)", async () => {
  await openBakery();
  const quitting = app;
  if (quitting === undefined) throw new Error("Webforge isn't running");
  // As on a busy computer, where the process took up to a minute to end after quitting (#393):
  // held in its teardown for 10 s. When it exits, once it has closed the site file (R13b: its
  // will-quit handler waits for that, then calls app.exit), it says whether it still holds the
  // lock that would hand a new launch's site to it.
  const lockAfterQuit = new Promise<string>((resolve) => {
    // Everything written so far: a line can arrive split across two chunks.
    let written = "";
    quitting.process().stderr?.on("data", (data: Buffer) => {
      written += data.toString();
      const held = /\[test\] lock held: (true|false)/.exec(written)?.[1];
      if (held !== undefined) resolve(held);
    });
  });
  await quitting.evaluate(({ app: electronApp }) => {
    const exit = electronApp.exit.bind(electronApp);
    Object.assign(electronApp, {
      exit: (code?: number) => {
        process.stderr.write(`[test] lock held: ${electronApp.hasSingleInstanceLock()}\n`);
        // A turn for the line to reach the test, then the slow end.
        setTimeout(() => {
          const end = Date.now() + 10_000;
          while (Date.now() < end) {
            // Ending.
          }
          exit(code);
        }, 100);
      },
    });
    setTimeout(() => electronApp.quit(), 0);
  });
  expect(await lockAfterQuit).toBe("false");

  app = await launchDesktopApp({ args: [bakery], userDataDir: userData });

  const page = await app.firstWindow();
  await waitForCanvas(page);
  expect(await currentFile(page)).toBe("Bakery.wforge");
  await quitting.close();
});
