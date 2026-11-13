import { type ElectronApplication, expect, type Locator, type Page, test } from "@playwright/test";
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

/**
 * Waits until `dialog` takes the Escape key (#676). Radix gives Escape to the top dialog only once
 * React has run its effects, a frame or two after the dialog shows and focuses its button; until
 * then the dialog below it, or one still closing, takes the key and the Escape is lost. So: no
 * dialog still closing, `dialog` drawn as the top one (the only one taking the pointer), then two
 * frames for its effects.
 */
async function ownsEscape(dialog: Locator): Promise<void> {
  await expect(
    page.locator('[role="dialog"][data-state="closed"], [role="alertdialog"][data-state="closed"]'),
  ).toHaveCount(0);
  await expect(dialog).toHaveCSS("pointer-events", "auto");
  await page.evaluate(
    () =>
      new Promise((frames) => requestAnimationFrame(() => requestAnimationFrame(() => frames(0)))),
  );
}

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
  // The kinds are a list in the bar at the top (CT-11).
  await studio()
    .getByRole("combobox", { name: "Sections and elements" })
    .selectOption({ value: "Features" });
  // The section's own Background, not its cards'.
  const field = studio().locator('[data-field="lookBackground"]');
  const accent = field.getByRole("radio", { name: "Accent", exact: true });
  // It stays where it first shows while the look's preview draws, so one click lands (#626):
  // the preview is in the strip above the controls (CT-11). Within 2 px: the dialog may still be
  // finishing its zoom as it opens (0.7 px on macOS, #972), while a preview pushing the controls
  // down moved them by its height.
  await expect(accent).toBeVisible();
  const shownAt = await accent.boundingBox();
  // Drawn: the strip's figures hold the drawings' frames.
  await expect(studio().locator("figure iframe")).toHaveCount(2);
  const drawnAt = await accent.boundingBox();
  expect(Math.abs((drawnAt?.x ?? 0) - (shownAt?.x ?? Number.NaN))).toBeLessThanOrEqual(2);
  expect(Math.abs((drawnAt?.y ?? 0) - (shownAt?.y ?? Number.NaN))).toBeLessThanOrEqual(2);
  // One click: a draft (4.10). Applied, a built-in theme asks for a name for the person's own
  // version first (2.23).
  await accent.click();
  // Apply Changes and Discard are in the bar at the bottom, always in view (CT-11).
  const apply = studio().getByRole("button", { name: "Apply Changes" });
  await apply.click();
  const naming = page.getByRole("dialog", { name: "Save your own version of 'Light'?" });
  await expect(naming).toBeVisible();
  await naming.getByRole("button", { name: "Save Theme" }).click();
  const question = page.getByRole("alertdialog", { name: "Change how every Features looks?" });
  await expect(question).toBeVisible();

  // It opens with Cancel focused (the owner's decision). Meant for Theme Studio, the Escape
  // cancels the question.
  await expect(question.getByRole("button", { name: "Cancel" })).toBeFocused();
  await ownsEscape(question);
  await page.keyboard.press("Escape");

  await expect(question).toBeHidden();
  const notChanged = page.locator("[data-sonner-toast]", { hasText: "Not changed" });
  await expect(notChanged).toHaveCount(1);
  await expect(studio()).toBeVisible();
  // The changes are still a draft to apply or discard; Discard goes back.
  await expect(accent).toHaveAttribute("aria-checked", "true");
  await studio().getByRole("button", { name: "Discard" }).click();
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
  await studio().getByRole("button", { name: "Discard" }).click();
  await expect(corners).toHaveValue(theirs);
  await ownsEscape(studio());
  await page.keyboard.press("Escape");
  await expect(studio()).toBeHidden();
  await expect(features).not.toHaveClass(/bg-secondary!/);
  expect(await background()).toBe(before);
});
