import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp } from "./launch.js";

// The shared Header and Footer (1.20, F-ED-7, C5): stored once, shown on every page; an edit on one
// page shows on all of them, and one undo reverts it everywhere.

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  await expect(canvas().locator("style[data-webforge-site-css]")).toHaveCount(1);
});

test.afterEach(async () => {
  await app.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const footer = () => canvas().locator(".site-footer p");
const steps = () => page.locator(".undo-history__step");
const showPage = (title: string) =>
  page
    .getByRole("toolbar", { name: "Canvas" })
    .getByRole("combobox", { name: "Page shown" })
    .selectOption(title);

test("edits the Footer on one page, shows it on another, and undoes it everywhere", async () => {
  await expect(canvas().locator(".site-header")).toBeVisible();
  await expect(footer()).toHaveText("Thanks for visiting.");

  await footer().click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Come again!", { delay: 20 });
  await expect(footer()).toHaveText("Thanks for visiting. Come again!");

  await showPage("Page not found");
  await expect(canvas().locator("h1")).toHaveText("Sorry, this page doesn't exist");
  await expect(footer()).toHaveText("Thanks for visiting. Come again!");
  await expect(steps().first()).toHaveText("Edited shared Footer text");

  await page.locator(".editor__canvas").focus();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(footer()).toHaveText("Thanks for visiting.");
  await showPage("My site");
  await expect(footer()).toHaveText("Thanks for visiting.");
});

test("says how far a change reaches, edits the Footer in the Edit panel, and hides it on one page", async () => {
  const banner = page.locator(".editor > [role='status']");
  await expect(banner).toHaveCount(0);

  // Its edge, not its text: clicking the text edits it.
  await canvas()
    .locator(".site-footer")
    .click({ position: { x: 4, y: 4 } });
  await expect(banner).toHaveText("Editing shared Footer: changes apply to all 2 pages");
  const panel = page.getByRole("region", { name: "Right panels" });
  await panel.getByLabel("Text").fill("See you soon");
  await expect(footer()).toHaveText("See you soon");
  await expect(steps().first()).toHaveText("Edited shared Footer text");

  await panel.getByRole("tab", { name: "Site" }).click();
  await panel.getByRole("button", { name: "Actions for My site" }).click();
  await page.getByRole("menuitem", { name: "Page Settings…" }).click();
  const dialog = page.getByRole("dialog", { name: "Settings for 'My site'" });
  await dialog.getByRole("checkbox", { name: "Hide the Footer on this page" }).check();
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(canvas().locator(".site-footer")).toHaveCount(0);
  await expect(canvas().locator(".site-header")).toBeVisible();
  await expect(banner).toHaveCount(0);
  await showPage("Page not found");
  await expect(footer()).toHaveText("See you soon");
});
