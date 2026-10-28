import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, waitForCanvas } from "./launch.js";

// Style this ‹kind›… (3.13a, CT-2): from the Style tab, a change shows on the canvas at once and
// becomes one labelled undo step on Apply; Cancel takes it back.

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
const steps = () => page.locator(".undo-history__step");
const dialog = () => page.getByRole("dialog", { name: "Style this Hero" });

/** Adds a Hero, which is selected, and opens Style this Hero… from the Style tab. */
async function styleNewHero() {
  await left().getByRole("tab", { name: "Add" }).click();
  await left().getByRole("button", { name: "Hero", exact: true }).click();
  await expect(canvas().locator(".site-hero h1")).toBeVisible();
  await panel().getByRole("tab", { name: "Style" }).click();
  await panel().getByRole("button", { name: "Style This Hero…" }).click();
  await expect(dialog()).toBeVisible();
}

test("styles a Hero in the dialog, live on the canvas, as one step on Apply (3.13a)", async () => {
  const title = canvas().locator(".site-hero h1");
  await styleNewHero();
  await expect(dialog().getByText("Desktop", { exact: true })).toBeVisible();
  await expect(dialog().getByText("Mobile", { exact: true })).toBeVisible();

  await dialog().getByRole("switch", { name: "Underline" }).click();
  // On the canvas at once, while the dialog is open.
  await expect(title).toHaveClass(/(^| )underline!( |$)/);
  await dialog()
    .getByRole("radio", { name: /^This Hero only/ })
    .check();
  await dialog().getByRole("button", { name: "Apply" }).click();

  await expect(dialog()).toBeHidden();
  await left().getByRole("tab", { name: "Undo History" }).click();
  await expect(steps().first()).toHaveText("Styled Hero");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(title).not.toHaveClass(/underline!/);
});

test("takes the dialog's changes back on Cancel (3.13a)", async () => {
  const title = canvas().locator(".site-hero h1");
  await styleNewHero();

  await dialog().getByRole("switch", { name: "Underline" }).click();
  await expect(title).toHaveClass(/(^| )underline!( |$)/);
  await dialog().getByRole("button", { name: "Cancel" }).click();

  await expect(dialog()).toBeHidden();
  await expect(title).not.toHaveClass(/underline!/);
});
