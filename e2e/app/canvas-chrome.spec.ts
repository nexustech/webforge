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

    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(canvas().locator("h1")).toHaveCount(2);
  });
});
