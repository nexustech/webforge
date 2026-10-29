import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";

// A theme change cancelled at its question says so (#614): an Escape meant to close Theme Studio
// answers "Change how every Features looks?" first, which has Cancel focused. The note says "Not
// changed", the control goes back to the theme's value, and the canvas stays as it was.

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
const studio = () => page.getByRole("dialog", { name: "Theme Studio" });

test("a look cancelled at its question with Escape says 'Not changed' and goes back (#614)", async () => {
  const left = page.getByRole("region", { name: "Left panels" });
  await left.getByRole("tab", { name: "Add" }).click();
  await left.getByRole("button", { name: "Features", exact: true }).click();
  const features = canvas().locator(".site-features").first();
  await expect(features).toBeVisible();
  const background = () =>
    features.evaluate((element) => getComputedStyle(element).backgroundColor);
  const before = await background();

  await chooseFromMenu(app, page, "View", "Theme Studio…");
  await studio().getByRole("tab", { name: "Components" }).click();
  await studio()
    .getByRole("navigation", { name: "Sections and elements" })
    .getByRole("button", { name: "Features", exact: true })
    .click();
  await expect(studio().getByRole("region", { name: "Features" })).toBeVisible();
  // The section's own Background, not its cards'.
  const field = studio().locator('[data-field="lookBackground"]');
  const accent = field.getByRole("radio", { name: "Accent", exact: true });
  // A built-in theme asks for a name for the person's own version first (2.23). A click while
  // the look is still being drawn can go unanswered: clicked again until it asks.
  const naming = page.getByRole("dialog", { name: "Save your own version of 'Light'?" });
  await expect(async () => {
    if (!(await naming.isVisible())) await accent.click();
    await expect(naming).toBeVisible({ timeout: 2_000 });
  }).toPass();
  await naming.getByRole("button", { name: "Save Theme" }).click();
  const question = page.getByRole("alertdialog", { name: "Change how every Features looks?" });
  await expect(question).toBeVisible();

  // Meant for Theme Studio, the Escape cancels the question.
  await page.keyboard.press("Escape");

  await expect(question).toBeHidden();
  await expect(
    page.locator("[data-sonner-toast]", { hasText: "Not changed" }).first(),
  ).toBeVisible();
  await expect(accent).toHaveAttribute("aria-checked", "false");
  await expect(studio()).toBeVisible();

  // A select goes back too, cancelled at the name it asks for first.
  const corners = studio().getByRole("combobox", { name: "Corners" }).first();
  const theirs = await corners.inputValue();
  await corners.selectOption({ label: "Round" });
  await naming.getByRole("button", { name: "Cancel" }).click();
  await expect(naming).toBeHidden();
  await expect(
    page.locator("[data-sonner-toast]", { hasText: "Not changed" }).first(),
  ).toBeVisible();
  await expect(corners).toHaveValue(theirs);
  await page.keyboard.press("Escape");
  await expect(studio()).toBeHidden();
  await expect(features).not.toHaveClass(/bg-secondary!/);
  expect(await background()).toBe(before);
});
