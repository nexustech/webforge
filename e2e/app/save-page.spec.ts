import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, type WebforgeApp, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";
import { stubFileDialogs } from "./sites.js";

// Save Page as Image… and Save Page as PDF… (5.22, OL-9): the page shown, as Preview builds it,
// drawn by the main process in a hidden window of its own at the canvas's device width.

let app: WebforgeApp;
let page: Page;
let dir: string;

test.beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "webforge-save-page-"));
  // Its own user data, in `dir`: the log names the step of a drawing that took too long (#1508).
  app = await launchDesktopApp({ userDataDir: join(dir, "user-data") });
  page = await app.firstWindow();
  await waitForCanvas(page);
});

test.afterEach(async () => {
  await app.close();
  await rm(dir, { recursive: true, force: true });
});

/**
 * Waits for the save's own words: "Saved …", or the app's message that it couldn't, which fails
 * the test with the steps the app's log names as having taken too long (#1508), never a bare
 * timeout. Each step has 20 s and one more go in a fresh window, so a save that hangs twice still
 * says so within its 3 minutes.
 */
async function savedOrFailed(name: string): Promise<void> {
  const saved = page.getByText(`Saved ${name}`);
  const failed = page.getByText(/couldn't (draw the page|make the PDF)/);
  await expect(saved.or(failed)).toBeVisible({ timeout: 150_000 });
  if (await saved.isVisible()) return;
  const log = join(dir, "user-data", "logs", "main.log");
  const steps = existsSync(log) ? readFileSync(log, "utf8").match(/timeout-[a-z]+/g) : null;
  throw new Error(
    `The app couldn't save ${name}: ${await failed.first().textContent()} (took too long: ${steps?.join(", ") ?? "no step logged"})`,
  );
}

/** A PNG's width and height, from its header. */
const pngSize = (data: Buffer) => ({ width: data.readUInt32BE(16), height: data.readUInt32BE(20) });

test("saves the page shown as one picture of all of it, at Mobile's width, and as a PDF", async () => {
  // Two saves, each with its steps' time and one more go (#1508).
  test.slow();
  // Quarantined on Windows: its PDF ran out of the test's time once there, and passed again (#1508).
  test.fixme(process.platform === "win32", "flaky on Windows CI: #1508");
  // Longer than any window: four Heroes after the starter page's own sections.
  const left = page.getByRole("region", { name: "Left panels" });
  await left.getByRole("tab", { name: "Add", exact: true }).click();
  await left.getByRole("tab", { name: "Sections" }).click();
  for (let hero = 0; hero < 4; hero += 1) {
    await left
      .getByRole("list", { name: "All sections" })
      .getByRole("button", { name: "Hero" })
      .click();
  }
  await chooseFromMenu(app, page, "View", "Mobile View");

  const image = join(dir, "Home.png");
  await stubFileDialogs(app, image);
  await chooseFromMenu(app, page, "File", "Save Page as Image");
  await savedOrFailed("Home.png");
  const png = readFileSync(image);
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  const size = pngSize(png);
  expect(size.width).toBe(375);
  // All of the page, not only what a window shows of it.
  const windowHeight = await page.evaluate(() => window.innerHeight);
  expect(size.height).toBeGreaterThan(Math.max(windowHeight, 900));

  const pdf = join(dir, "Home.pdf");
  await stubFileDialogs(app, pdf);
  await chooseFromMenu(app, page, "File", "Save Page as PDF");
  await savedOrFailed("Home.pdf");
  expect(readFileSync(pdf).subarray(0, 5).toString()).toBe("%PDF-");
});

test("writes nothing when the save dialog is cancelled", async () => {
  await app.evaluate(({ dialog }) => {
    Object.assign(dialog, { showSaveDialog: async () => ({ canceled: true, filePath: "" }) });
  });
  await chooseFromMenu(app, page, "File", "Save Page as Image");
  // Enabled again once it's done, with nothing said and nothing written.
  await chooseFromMenu(app, page, "File", "Save Page as PDF");
  await expect(page.getByText(/^Saved /)).toHaveCount(0);
  expect(await import("node:fs").then(({ readdirSync }) => readdirSync(dir))).toEqual([]);
});
