import { type ElectronApplication, expect, type Locator, type Page, test } from "@playwright/test";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";

// Theme Studio's X closes Theme Studio, not the app (#1411). Windows draws its own minimise,
// maximise and close buttons over the title bar, above everything the page draws: Theme Studio,
// which filled the window but for a margin, had its X under the window's, which closed the app.
// That every dialog starts below the title bar, at full size, in a narrow window and at 150%, is
// dialog-fit.spec.ts's to check (#1433).

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

const studio = () => page.getByRole("dialog", { name: "Theme Studio" });
/** A dialog's own X, in its top-right corner: the last of its children. */
const cornerClose = (dialog: Locator) => dialog.locator(':scope > button[aria-label="Close"]');

test("Theme Studio's X closes Theme Studio, not the app, with nothing to ask (#1411, M1)", async () => {
  await chooseFromMenu(app, page, "Site", "Theme Studio…");
  await studio().getByRole("tab", { name: "Components" }).click();
  await studio()
    .getByRole("combobox", { name: "Sections and elements" })
    .selectOption({ value: "Features" });
  await studio()
    .locator('[data-field="lookBackground"]')
    .getByRole("radio", { name: "Accent", exact: true })
    .click();

  // Applied at once (M1): the X closes straight away, asking nothing. The window, and the site in
  // it, stay open.
  await cornerClose(studio()).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(studio()).toHaveCount(0);
  await expect(page.getByRole("banner")).toBeVisible();
  expect(page.isClosed()).toBe(false);
});
