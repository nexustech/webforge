import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";

// A theme change cancelled at its question says so (#614): an Escape meant to close Theme Studio
// answers "Change how every Features looks?" first, which has Cancel focused. The note says "Not
// changed", the changes stay a draft to apply or discard (4.10), Discard takes the control back to
// the theme's value, and the canvas stays as it was.

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
  // The section's own Background, not its cards'.
  const field = studio().locator('[data-field="lookBackground"]');
  const accent = field.getByRole("radio", { name: "Accent", exact: true });
  // It stays where it first shows while the look's preview draws, so one click lands (#626).
  await expect(accent).toBeVisible();
  const shownAt = await accent.boundingBox();
  // Drawn: the preview's figure holds the drawing's host.
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[role="dialog"] figure div')].some((each) => each.shadowRoot),
  );
  expect(await accent.boundingBox()).toEqual(shownAt);
  // One click: a draft (4.10). Applied, a built-in theme asks for a name for the person's own
  // version first (2.23).
  await accent.click();
  const region = studio().getByRole("region", { name: "Features" });
  const apply = region.getByRole("button", { name: "Apply Changes" });
  await apply.click();
  const naming = page.getByRole("dialog", { name: "Save your own version of 'Light'?" });
  await expect(naming).toBeVisible();
  await naming.getByRole("button", { name: "Save Theme" }).click();
  const question = page.getByRole("alertdialog", { name: "Change how every Features looks?" });
  await expect(question).toBeVisible();

  // It opens with Cancel focused (the owner's decision). Meant for Theme Studio, the Escape
  // cancels the question.
  await expect(question.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Escape");

  await expect(question).toBeHidden();
  const notChanged = page.locator("[data-sonner-toast]", { hasText: "Not changed" });
  await expect(notChanged).toHaveCount(1);
  await expect(studio()).toBeVisible();
  // The changes are still a draft to apply or discard; Discard goes back.
  await expect(accent).toHaveAttribute("aria-checked", "true");
  await region.getByRole("button", { name: "Discard" }).click();
  await expect(accent).toHaveAttribute("aria-checked", "false");

  // Cancelled at the name it asks for first, too. The first note goes on its own after a few
  // seconds: gone, the second is then the one shown.
  await expect(notChanged).toHaveCount(0, { timeout: 15_000 });
  const corners = studio().getByRole("combobox", { name: "Corners" }).first();
  const theirs = await corners.inputValue();
  await corners.selectOption({ label: "Round" });
  await apply.click();
  await naming.getByRole("button", { name: "Cancel" }).click();
  await expect(naming).toBeHidden();
  await expect(notChanged).toHaveCount(1);
  await region.getByRole("button", { name: "Discard" }).click();
  await expect(corners).toHaveValue(theirs);
  await page.keyboard.press("Escape");
  await expect(studio()).toBeHidden();
  await expect(features).not.toHaveClass(/bg-secondary!/);
  expect(await background()).toBe(before);
});
