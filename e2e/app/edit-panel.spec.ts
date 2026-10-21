import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp } from "./launch.js";

// The Edit panel (1.14): the selected element's fields, each change one labelled undo step.

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  await expect(canvas().locator("style[data-webforge-site-css]")).toHaveCount(1);
});

test.afterEach(async () => {
  await app.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
/** The editor's right-hand panels, where the Edit panel is (not Puck's own field UI). */
const panel = () => page.getByRole("region", { name: "Right panels" });
const steps = () => page.locator(".undo-history__step");

/** Selects the heading by clicking past the end of its text (clicking the text edits it). */
async function selectHeading(): Promise<void> {
  const heading = canvas().locator(".site-heading");
  const box = await heading.boundingBox();
  if (box === null) throw new Error("Heading not visible");
  await heading.click({ position: { x: box.width * 0.97, y: 2 } });
}

test.describe("Edit panel", () => {
  test("asks for a selection, then shows the selected element's fields", async () => {
    await expect(panel().getByText("Select an element to edit it")).toBeVisible();

    await selectHeading();

    await expect(panel().getByRole("heading", { name: "Heading", exact: true })).toBeVisible();
    await expect(panel().getByLabel("Text", { exact: true })).toHaveValue(
      "Welcome to our business",
    );
  });

  test("changes the heading's size as one step, on the canvas too", async () => {
    await selectHeading();
    await panel().getByRole("tab", { name: "Style" }).click();

    await panel().getByLabel("Size", { exact: true }).selectOption("small");

    await expect(steps().first()).toHaveText("Changed Heading size");
    await expect(canvas().locator("h3.site-heading")).toHaveText("Welcome to our business");
  });

  test("makes one step of typing in a text field", async () => {
    await selectHeading();
    const field = panel().getByLabel("Text", { exact: true });

    await field.click();
    await page.keyboard.press("End");
    await page.keyboard.type(" today", { delay: 20 });
    await expect(canvas().locator(".site-heading")).toHaveText("Welcome to our business today");
    // Leaving the field ends the visit.
    await panel().getByRole("tab", { name: "Style" }).click();

    await expect(steps()).toHaveText(["Edited Heading text", "Opened page"]);
  });
});

test("undoes with Ctrl/Cmd+Z in a panel field through the site's history (ADR 0004)", async () => {
  await selectHeading();
  const field = panel().getByLabel("Text", { exact: true });
  await field.click();
  await page.keyboard.press("End");
  await page.keyboard.type("!", { delay: 20 });
  await expect(steps().first()).toHaveText("Edited Heading text");

  await page.keyboard.press("ControlOrMeta+z");

  await expect(field).toHaveValue("Welcome to our business");
  await expect(canvas().locator(".site-heading")).toHaveText("Welcome to our business");
  await expect(page.locator('.undo-history__step[aria-current="step"]')).toHaveText("Opened page");
});
