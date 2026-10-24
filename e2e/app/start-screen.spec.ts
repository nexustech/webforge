import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { placeCaret } from "./caret.js";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
import { stubFileDialogs } from "./sites.js";

// The start screen (F-SITE-1, F-SITE-2): new → edit → quit → reopen from the Recent list.

const STARTER_HEADING = "Welcome to our business";

let dir: string;
let userData: string;
let app: ElectronApplication | undefined;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-start-"));
  userData = join(dir, "user-data");
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

const canvas = (page: Page) => page.frameLocator(".editor__canvas iframe");

/** The running app; tests call it once they have launched one. */
function running(): ElectronApplication {
  if (app === undefined) throw new Error("The app is not running");
  return app;
}

async function startWithoutSite(): Promise<Page> {
  app = await launchDesktopApp({ userDataDir: userData, site: false });
  const page = await app.firstWindow();
  await expect(page.getByRole("heading", { name: "Start a site" })).toBeVisible();
  return page;
}

/** Closes the window as the user does, which saves and captures the Recent thumbnail. */
async function closeWindow(): Promise<void> {
  const closed = app?.waitForEvent("close");
  await app?.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.close();
  });
  await closed;
  app = undefined;
}

test("creates a blank site, keeps an edit and reopens it from the Recent list", async () => {
  let page = await startWithoutSite();
  await expect(page.getByText("Sites you open or create appear here.")).toBeVisible();

  // Blank site: the save dialog (stubbed) names the file, and the editor opens on it.
  const sitePath = join(dir, "Rosa's Bakery.wforge");
  await stubFileDialogs(running(), sitePath);
  await page.getByRole("button", { name: "Blank site" }).click();
  await waitForCanvas(page);
  await expect(page.getByRole("banner").getByRole("status")).toHaveText("Saved");

  const heading = canvas(page).locator("h1 [contenteditable]");
  await heading.hover();
  await heading.click();
  await placeCaret(heading, "end");
  await page.keyboard.type(" today", { delay: 20 });
  await expect(canvas(page).locator("h1")).toHaveText(`${STARTER_HEADING} today`);
  await closeWindow();

  // Next launch: the start screen lists the site with its thumbnail and when it was edited.
  page = await startWithoutSite();
  const card = page.getByRole("listitem").filter({ hasText: "Rosa's Bakery" });
  await expect(card).toContainText("Edited");
  await expect(card).toContainText("Rosa's Bakery.wforge");
  await expect(card.locator("img")).toHaveAttribute("src", /^data:image\/jpeg;base64,/);

  await card.getByRole("button").first().click();
  await expect(canvas(page).locator("h1")).toHaveText(`${STARTER_HEADING} today`, {
    timeout: 30_000,
  });
});

test("says when a site can't be opened, and removes sites from the list", async () => {
  // Open a site once, so it is on the list, then lose the file.
  app = await launchDesktopApp({ userDataDir: userData });
  await app.firstWindow();
  await app.close();
  app = undefined;

  const page = await startWithoutSite();
  const card = page.getByRole("listitem");
  await expect(card).toHaveCount(1);
  await page.getByRole("button", { name: /^Remove .+ from the list$/ }).click();
  await expect(card).toHaveCount(0);

  // A file that isn't a site.
  const notes = join(dir, "notes.wforge");
  writeFileSync(notes, "just text");
  await stubFileDialogs(running(), notes);
  await page.getByRole("button", { name: "Open a site…" }).click();
  await expect(page.getByRole("alert")).toHaveText("This file isn't a Webforge site.");

  // With nothing to save, closing doesn't wait for a save that never comes (5 s timeout).
  const started = Date.now();
  await closeWindow();
  expect(Date.now() - started).toBeLessThan(3_000);
});
