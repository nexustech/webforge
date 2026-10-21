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
