import { type ElectronApplication, expect, type Locator, type Page, test } from "@playwright/test";
import { stillBox } from "./canvas-click.js";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";

// A theme change cancelled at its question says so (#614): an Escape meant to close Theme Studio
// answers "Switch to the theme …?" first, which has Cancel focused. The note says "Not changed",
// and the canvas stays as it was. A look in Components asks nothing (M1): it applies at once, and
// a notice says how far it reached, announced, which Ctrl/Cmd+Z takes back from the keyboard.

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

/** Adds a Features, and returns it on the canvas with its background colour as drawn. */
async function addFeatures() {
  const left = page.getByRole("region", { name: "Left panels" });
  await left.getByRole("tab", { name: "Add" }).click();
  await left.getByRole("button", { name: "Features", exact: true }).click();
  const features = canvas().locator(".site-features").first();
  await expect(features).toBeVisible();
  const background = () =>
    features.evaluate((element) => getComputedStyle(element).backgroundColor);
  return { features, background };
}

test("a theme cancelled at its question with Escape says “Not changed” and goes back (#614)", async () => {
  const { background } = await addFeatures();
  const before = await background();

  await chooseFromMenu(app, page, "Site", "Theme Studio…");
  await studio().getByRole("tab", { name: "Themes" }).click();
  await studio()
    .getByRole("button", { name: /^Bistro/ })
    .first()
    .click();
  const question = page.getByRole("alertdialog", { name: "Switch to the theme “Bistro”?" });
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
  await ownsEscape(studio());
  await page.keyboard.press("Escape");
  await expect(studio()).toBeHidden();
  expect(await background()).toBe(before);
});

test("a look applies at once, unasked, announced with Undo, and Ctrl+Z takes it back (M1)", async () => {
  const { features, background } = await addFeatures();
  const before = await background();

  await chooseFromMenu(app, page, "Site", "Theme Studio…");
  await studio().getByRole("tab", { name: "Components" }).click();
  // The kinds are a list in the bar at the top (CT-11).
  await studio()
    .getByRole("combobox", { name: "Sections and elements" })
    .selectOption({ value: "Features" });
  // The section's own Background, not its cards'.
  const field = studio().locator('[data-field="lookBackground"]');
  const accent = field.getByRole("radio", { name: "Accent", exact: true });
  // It stays where it first shows while the look's preview draws, so one click lands (#626).
  // Read once the dialog has finished its zoom as it opens (#972, #1275). Within 2 px, for
  // rounding.
  await expect(accent).toBeVisible();
  await stillBox(studio());
  const shownAt = await accent.boundingBox();
  // Drawn: the preview's figures hold the drawings' frames.
  await expect(studio().locator("figure iframe").first()).toBeVisible();
  const drawnAt = await accent.boundingBox();
  expect(Math.abs((drawnAt?.x ?? 0) - (shownAt?.x ?? Number.NaN))).toBeLessThanOrEqual(2);
  expect(Math.abs((drawnAt?.y ?? 0) - (shownAt?.y ?? Number.NaN))).toBeLessThanOrEqual(2);

  // One click, no question: on the canvas at once.
  await accent.click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(features).toHaveClass(/bg-secondary!/);
  // Said after, in a live region a screen reader announces, with Undo.
  const notice = page.locator("[data-sonner-toast]", {
    hasText: "Changed every Features on your site (1)",
  });
  await expect(notice).toHaveCount(1);
  await expect(notice.getByRole("button", { name: "Undo" })).toBeVisible();
  expect(
    await notice.evaluate((toast) => toast.closest("[aria-live]")?.getAttribute("aria-live")),
  ).toBe("polite");

  // The keyboard's Undo, inside Theme Studio, takes it back.
  await accent.focus();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(features).not.toHaveClass(/bg-secondary!/);
  await expect(accent).toHaveAttribute("aria-checked", "false");
  await ownsEscape(studio());
  await page.keyboard.press("Escape");
  await expect(studio()).toBeHidden();
  expect(await background()).toBe(before);
});
