import { type ElectronApplication, expect, type Locator, type Page, test } from "@playwright/test";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";

// A gradient's direction turns it on (CT-10, 5.11): chosen in *Style this Hero…* or for every Hero
// in Theme Studio › Components, it draws Brand to Accent on the canvas at once, without a colour
// chosen. The product owner's steps from 12 Nov 2026, when the end colour left at Theme's drew
// nothing.

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
const panel = () => page.getByRole("region", { name: "Right panels" });
const hero = () => canvas().locator(".site-hero");

/** Adds a Hero, which is selected. */
async function addHero() {
  await left().getByRole("tab", { name: "Add" }).click();
  await left().getByRole("button", { name: "Hero", exact: true }).click();
  await expect(hero()).toHaveCount(1);
}

/** Whether `section` draws a gradient from Brand to Accent, left to right. */
async function expectBrandToAccent(section: Locator) {
  await expect(section).toHaveClass(/(^| )bg-linear-to-r!( |$)/);
  await expect(section).toHaveClass(/(^| )from-primary!( |$)/);
  await expect(section).toHaveClass(/(^| )to-secondary!( |$)/);
  // Drawn, not just named: the canvas's stylesheet has the gradient.
  await expect
    .poll(() => section.evaluate((element) => getComputedStyle(element).backgroundImage))
    .toContain("linear-gradient");
}

test("a direction chosen in Style this Hero… draws Brand to Accent, as one step (CT-10)", async () => {
  await addHero();
  await panel().getByRole("tab", { name: "Style" }).click();
  await panel().getByRole("button", { name: "Style This Hero…" }).click();
  const dialog = page.getByRole("dialog", { name: "Style this Hero" });
  // No colour rows while the gradient is off.
  await expect(dialog.getByText("Gradient starts with")).toHaveCount(0);

  await dialog.getByRole("combobox", { name: "Gradient", exact: true }).selectOption("toRight");

  // Both colours at once, shown as chosen, and on the canvas while the dialog is open.
  await expect(dialog.getByText("Gradient starts with")).toBeVisible();
  await expect(
    dialog
      .locator('[data-field="lookGradientFrom"]')
      .getByRole("radio", { name: "Brand", exact: true }),
  ).toBeChecked();
  await expect(
    dialog
      .locator('[data-field="lookGradientTo"]')
      .getByRole("radio", { name: "Accent", exact: true }),
  ).toBeChecked();
  await expectBrandToAccent(hero());

  await dialog.getByRole("radio", { name: /^This Hero only/ }).check();
  await dialog.getByRole("button", { name: "Apply" }).click();
  await expect(dialog).toBeHidden();
  await expectBrandToAccent(hero());

  // One step takes the direction and its colours back together.
  await page.keyboard.press("ControlOrMeta+z");
  await expect(hero()).not.toHaveClass(/bg-linear-to-r!/);
  await expect(hero()).not.toHaveClass(/from-primary!/);
});

test("a direction chosen for every Hero in Theme Studio draws Brand to Accent once applied (CT-10)", async () => {
  await addHero();

  await chooseFromMenu(app, page, "View", "Theme Studio…");
  const studio = page.getByRole("dialog", { name: "Theme Studio" });
  await studio.getByRole("tab", { name: "Components" }).click();
  // The kinds are a list in the bar at the top (CT-11).
  await studio
    .getByRole("combobox", { name: "Sections and elements" })
    .selectOption({ value: "Hero" });
  const look = studio.getByRole("region", { name: "Hero" });
  await look.getByRole("combobox", { name: "Gradient", exact: true }).selectOption("toRight");
  await expect(look.getByText("Gradient ends with")).toBeVisible();
  // In the bar at the bottom, always in view (CT-11).
  await studio.getByRole("button", { name: "Apply Changes" }).click();
  // A built-in theme is changed as the person's own copy of it (2.23), and every Hero asks (D7).
  await page
    .getByRole("dialog", { name: /^Save your own version of/ })
    .getByRole("button", { name: "Save Theme" })
    .click();
  await page
    .getByRole("alertdialog", { name: "Change how every Hero looks?" })
    .getByRole("button", { name: "Change Look" })
    .click();
  await studio.getByRole("button", { name: "Close", exact: true }).click();
  await expect(studio).toHaveCount(0);

  await expectBrandToAccent(hero());
});
