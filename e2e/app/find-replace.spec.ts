import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, waitForCanvas } from "./launch.js";

// Find and Replace (6.2): Ctrl+F opens its panel in the bottom drawer with the cursor in Find; a
// match selects its element; Replace All changes every match as one undo step.

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

test("finds text on the page from Ctrl+F, selects it, and replaces it all as one step", async () => {
  await page.keyboard.press("ControlOrMeta+F");

  const find = drawer().getByRole("searchbox", { name: "Find" });
  await expect(find).toBeFocused();
  // The starter page: "Tell visitors what you do and why they will love it."
  await find.fill("visitors");
  await expect(drawer().getByRole("status")).toHaveText("1 match in 1 place");

  await drawer()
    .getByRole("button", { name: /^Text · Text: Tell visitors/ })
    .click();
  const panel = page.getByRole("region", { name: "Right panels" });
  await expect(panel.getByRole("heading", { name: "Text", exact: true })).toBeVisible();

  await drawer().getByRole("textbox", { name: "Replace with" }).fill("customers");
  await drawer().getByRole("button", { name: "Replace All" }).click();

  await expect(drawer().getByRole("status")).toHaveText("Nothing found.");
  await expect(canvas().getByText("Tell customers what you do")).toBeVisible();

  await page.keyboard.press("ControlOrMeta+Z");
  await expect(canvas().getByText("Tell visitors what you do")).toBeVisible();
});
