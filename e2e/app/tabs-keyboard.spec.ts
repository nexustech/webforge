import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";
import { tabUntil } from "./tab-until.js";

// Tabs and the keyboard (#1650): Shift+Tab leaves a list of tabs, first in a dialog or not, and
// Tab comes back to the active tab in one stop. dialog-fit.spec.ts's rule 7 checks every dialog's
// ends; this walks the two lists of tabs a person uses most, through them and out.

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

test("Shift+Tab leaves Theme Studio's section tabs, and Tab comes back to the one chosen (#1650)", async () => {
  await chooseFromMenu(app, page, "Site", "Theme Studio…");
  const studio = page.getByRole("dialog", { name: "Theme Studio" });
  const components = studio.getByRole("tab", { name: "Components" });
  await components.click();
  // Before #1650, Shift+Tab from here stayed on the tab, however many times it was pressed.
  await tabUntil(page, studio.getByRole("button", { name: "Close", exact: true }), {
    back: true,
    within: studio,
  });
  await page.keyboard.press("Tab");
  await expect(components).toBeFocused();
});

test("Tab and Shift+Tab pass through the Edit panel's tabs (#1650)", async () => {
  const right = page.getByRole("region", { name: "Right panels" });
  const style = right.getByRole("tab", { name: "Style" });
  await page.frameLocator(".editor__canvas iframe").locator(".site-heading").first().click();
  await style.click();
  // Out of the panel's tabs backwards, then forwards into them again, never stuck on one.
  const help = right.getByRole("button", { name: "Help: The Edit panel" });
  await tabUntil(page, help, { back: true });
  await tabUntil(page, style);
});
