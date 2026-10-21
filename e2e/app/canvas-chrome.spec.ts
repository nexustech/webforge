import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp } from "./launch.js";

// Selection chrome on the canvas (1.12): magenta outlines and the selected element's quick
// actions, each one labelled undo step.

let app: ElectronApplication;
let page: Page;

const STARTER_HEADING = "Welcome to our business";
const STARTER_TEXT = "Tell visitors what you do and why they will love it.";

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  // Undo History is the left column's second tab, after Add.
  await page
    .getByRole("region", { name: "Left panels" })
    .getByRole("tab", { name: "Undo History" })
    .click();
  await expect(canvas().locator("style[data-webforge-site-css]")).toHaveCount(1);
});

test.afterEach(async () => {
  await app.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const steps = () => page.locator(".undo-history__step");
/** A quick action of the selected element (a hovered element shows a bar of its own too). */
const quickAction = (title: string) =>
  canvas()
    .locator("[data-puck-overlay]")
    .filter({ has: canvas().locator('.wf-outline[data-state="selected"]') })
    .locator(`[title="${title}"]`);

/** Selects the heading by clicking past the end of its text (clicking the text edits it). */
async function selectHeading(): Promise<void> {
  const heading = canvas().locator("h1");
  const box = await heading.boundingBox();
  if (box === null) throw new Error("Heading not visible");
  await heading.click({ position: { x: box.width * 0.97, y: 2 } });
  await expect(quickAction("Move down")).toBeVisible();
}

test.describe("selection chrome", () => {
  test("outlines the selected element in magenta", async () => {
    await selectHeading();

    const outline = canvas().locator('.wf-outline[data-state="selected"]');
    await expect(outline).toHaveCount(1);
    await expect(outline).toHaveCSS("outline-color", "rgb(240, 40, 243)");
    await expect(outline).toHaveCSS("outline-style", "solid");
  });

  test("moves, duplicates and deletes the selected element, one undo step each", async () => {
    await selectHeading();

    await quickAction("Move down").click();
    await expect(steps().first()).toHaveText("Moved Heading");
    await expect(canvas().locator(".site-section")).toContainText(
      `${STARTER_TEXT}${STARTER_HEADING}`,
    );

    await quickAction("Duplicate").click();
    await expect(steps().first()).toHaveText("Duplicated Heading");
    await expect(canvas().locator("h1")).toHaveCount(2);

    await quickAction("Delete").click();
    await expect(steps().first()).toHaveText("Deleted Heading");
    await expect(steps()).toHaveText([
      "Deleted Heading",
      "Duplicated Heading",
      "Moved Heading",
      "Opened page",
    ]);

    // The title bar's Undo: the delete's toast has an Undo button too (1.11).
    await page.getByRole("banner").getByRole("button", { name: "Undo", exact: true }).click();
    await expect(canvas().locator("h1")).toHaveCount(2);
  });
});

test.describe("keyboard and floating add", () => {
  test("arrows select, Alt+arrows move, Mod+D duplicates, Delete deletes; one step each", async () => {
    await selectHeading();

    await page.keyboard.press("ArrowDown");
    // The Text is selected now: its bar shows its label.
    await expect(quickAction("Move up")).toBeVisible();
    await page.keyboard.press("Alt+ArrowUp");
    await expect(steps().first()).toHaveText("Moved Text");
    await expect(canvas().locator(".site-section")).toContainText(
      `${STARTER_TEXT}${STARTER_HEADING}`,
    );

    await page.keyboard.press("ControlOrMeta+d");
    await expect(steps().first()).toHaveText("Duplicated Text");
    await page.keyboard.press("Delete");
    await expect(steps()).toHaveText([
      "Deleted Text",
      "Duplicated Text",
      "Moved Text",
      "Opened page",
    ]);
  });

  test("leaves arrows and Delete to text being edited", async () => {
    const field = canvas().locator("h1 [contenteditable]");
    await field.hover();
    await field.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Delete");

    await expect(canvas().locator("h1")).toHaveText("Welcome to our busine");
    await expect(steps().first()).toHaveText("Edited Heading text");
  });

  test("adds a section with the floating + below a section, chosen in the Add panel", async () => {
    const section = canvas().locator(".site-section");
    const box = await section.boundingBox();
    if (box === null) throw new Error("Section not visible");
    // The Section's bottom padding selects the Section itself.
    await section.click({ force: true, position: { x: 10, y: box.height - 4 } });

    await canvas().getByTitle("Add a section here").click();
    await page
      .getByRole("region", { name: "Left panels" })
      .getByRole("button", { name: "Section", exact: true })
      .click();
    await page
      .getByRole("region", { name: "Left panels" })
      .getByRole("tab", { name: "Undo History" })
      .click();

    await expect(steps().first()).toHaveText("Added Section");
    await expect(canvas().locator(".site-section")).toHaveCount(2);
  });
});
