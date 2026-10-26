import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { clickOnCanvas } from "./canvas-click.js";
import { launchDesktopApp, waitForCanvas } from "./launch.js";

// On macOS the editor's menus are the menu bar's (LF-13), and Edit's Undo and Redo there register
// their keys, so that Cmd+Z in a dialog's text field still undoes its text (site-settings.spec.ts
// checks that on every system). The editor handles the same keys itself everywhere else: a press
// must undo or redo one step, never one for the page and one more for the menu bar (#414 review).

test.skip(process.platform !== "darwin", "The menus are in the menu bar on macOS only");

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  await page
    .getByRole("region", { name: "Left panels" })
    .getByRole("tab", { name: "Undo History" })
    .click();
  await waitForCanvas(page);
});

test.afterEach(async () => {
  await app.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const steps = () => page.locator(".undo-history__step");

/** Where the history stands: 0 at the newest step, counting back to "Opened page". */
const current = () =>
  steps().evaluateAll((all) =>
    all.findIndex((step) => step.getAttribute("aria-current") === "step"),
  );

/** Waits for the history to stand at `at`, then a moment more: a second fire comes late too. */
async function expectAt(at: number): Promise<void> {
  await expect.poll(current).toBe(at);
  await page.evaluate(() => new Promise((settled) => setTimeout(settled, 300)));
  expect(await current()).toBe(at);
}

/** Puts the focus on the canvas, in its frame, with the heading selected. */
async function focusCanvas(): Promise<void> {
  // Duplicates of it follow it: the first is the one to click.
  const heading = canvas().locator("h1").first();
  const box = await heading.boundingBox();
  if (box === null) throw new Error("Heading not visible");
  await clickOnCanvas(heading, { position: { x: box.width * 0.97, y: box.height - 2 } });
}

/** Puts the focus in the Edit panel, on its search field. */
async function focusEditPanel(): Promise<void> {
  await page
    .getByRole("region", { name: "Right panels" })
    .getByRole("searchbox", { name: "Search options" })
    .focus();
}

test("Cmd+Z and Cmd+Shift+Z undo and redo one step, on the canvas and in the Edit panel", async () => {
  await focusCanvas();
  for (let copies = 0; copies < 3; copies += 1) await page.keyboard.press("Meta+d");
  await expect(steps()).toHaveText([
    "Duplicated Heading",
    "Duplicated Heading",
    "Duplicated Heading",
    "Opened page",
  ]);
  await expectAt(0);

  // Each press starts where a second undo or redo would still have a step to take: an undo at
  // the newest two steps, a redo at the third, so a double fire would show (#421 review).
  const press = async (where: () => Promise<void>, keys: string, at: number) => {
    await where();
    await page.keyboard.press(keys);
    await expectAt(at);
  };
  await press(focusCanvas, "Meta+z", 1);
  await press(focusEditPanel, "Meta+z", 2);
  await press(focusEditPanel, "Meta+Shift+z", 1);
  await press(focusCanvas, "Meta+z", 2);
  await press(focusCanvas, "Meta+Shift+z", 1);
  await expect(steps()).toHaveCount(4);
});
