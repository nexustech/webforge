import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";

// A kind's look on the canvas (3.12, CT-1; #622): set in Theme Studio › Components, it restyles
// every item of the kind that sets nothing of its own, as soon as Theme Studio closes. The product
// owner's steps from #614: Features › Background → Accent.

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

const canvas = () => page.frameLocator(".editor__canvas iframe");
const left = () => page.getByRole("region", { name: "Left panels" });

test("a kind's look set in Theme Studio shows on an item without its own, once it closes", async () => {
  // A Features section, setting no background of its own.
  await left().getByRole("button", { name: "Features", exact: true }).click();
  const features = canvas().locator(".site-features");
  await expect(features).toHaveCount(1);
  await expect(features).not.toHaveClass(/bg-secondary!/);

  await chooseFromMenu(app, page, "View", "Theme Studio…");
  const studio = page.getByRole("dialog", { name: "Theme Studio" });
  await studio.getByRole("tab", { name: "Components" }).click();
  await studio
    .getByRole("navigation", { name: "Sections and elements" })
    .getByRole("button", { name: "Features", exact: true })
    .click();
  await studio
    .getByRole("region", { name: "Features" })
    .locator('[data-field="lookBackground"]')
    .getByRole("radio", { name: "Accent", exact: true })
    .click();
  // A built-in theme is changed as the person's own copy of it (2.23), named first.
  await page
    .getByRole("dialog", { name: /^Save your own version of/ })
    .getByRole("button", { name: "Save Theme" })
    .click();
  // It restyles every Features on the site, so it asks first (D7).
  await page
    .getByRole("alertdialog", { name: "Change how every Features looks?" })
    .getByRole("button", { name: "Change Look" })
    .click();

  await studio.getByRole("button", { name: "Close", exact: true }).click();
  await expect(studio).toHaveCount(0);

  // The look's background, on the canvas: Accent is the theme's secondary colour.
  await expect(features).toHaveClass(/bg-secondary!/);
});
