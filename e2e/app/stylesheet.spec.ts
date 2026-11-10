import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { clickOnCanvas } from "./canvas-click.js";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";

// The Stylesheet panel (CT-8, 6.8): in Advanced mode, the site's custom.css in the bottom drawer,
// shown on the canvas as it's typed, each pause one undo step; Target This Element gives the
// selected element a rule of its own.

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  await waitForCanvas(page);
});

test.afterEach(async () => {
  await app.close();
});

const drawer = () => page.getByRole("region", { name: "Bottom panel" });
const canvas = () => page.frameLocator(".editor__canvas iframe");
const editor = () => drawer().getByRole("textbox", { name: "Stylesheet (custom.css)" });

/** Selects the starter page's heading, clicking past the end of its text, at its bottom edge. */
async function selectHeading(): Promise<void> {
  const heading = canvas().locator(".site-heading");
  const box = await heading.boundingBox();
  if (box === null) throw new Error("Heading not visible");
  await clickOnCanvas(heading, { position: { x: box.width * 0.97, y: box.height - 2 } });
}

/** The heading's computed `color` on the canvas. */
const headingColour = () =>
  canvas()
    .locator(".site-heading")
    .evaluate((element) => getComputedStyle(element).color);

test("styles the canvas as the stylesheet is typed, and undoes it a pause at a time", async () => {
  await chooseFromMenu(app, page, "View", "Use Advanced Mode");
  await chooseFromMenu(app, page, "View", "Stylesheet");
  const before = await headingColour();

  await editor().click();
  await page.keyboard.type(".site-heading { color: rgb(1, 2, 3); }", { delay: 10 });
  await expect.poll(headingColour).toBe("rgb(1, 2, 3)");

  await page.keyboard.press("ControlOrMeta+Z");
  await expect.poll(headingColour).toBe(before);
  await expect(editor()).toHaveText("");
});

test("gives the selected element a rule of its own with Target This Element", async () => {
  await chooseFromMenu(app, page, "View", "Use Advanced Mode");
  await chooseFromMenu(app, page, "View", "Stylesheet");
  await selectHeading();

  await drawer().getByRole("button", { name: "Target This Element" }).click();
  await expect(editor()).toBeFocused();
  await page.keyboard.type("color: rgb(4, 5, 6);");

  await expect.poll(headingColour).toBe("rgb(4, 5, 6)");
  await expect(editor()).toContainText(".heading {");
});
