import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp } from "./launch.js";

// Menu editor (1.21, F-ED-17): the menu follows the pages until edited; items are added with a
// label and a link, reordered by keyboard or drag, and every change is one undo step.

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  await page
    .getByRole("region", { name: "Left panels" })
    .getByRole("tab", { name: "Undo History" })
    .click();
  await page
    .getByRole("region", { name: "Right panels" })
    .getByRole("tab", { name: "Site" })
    .click();
});

test.afterEach(async () => {
  await app.close();
});

const menu = () => page.getByRole("region", { name: "Menu" });
/** The menu's items, by the text they show. */
const rows = () => menu().locator("[data-menu-item]");
const steps = () => page.locator(".undo-history__step");

test("adds a button, reorders by keyboard and drag, and undoes it all", async () => {
  // A new page joins the menu while it follows the pages.
  await page.getByRole("button", { name: "Add Page" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Add Page" }).click();
  await expect(rows()).toHaveText(["My site", "New page"]);

  await menu().getByRole("button", { name: "Add to Menu" }).click();
  await page.getByRole("menuitem", { name: "Button…" }).click();
  const dialog = page.getByRole("dialog", { name: "Menu button" });
  await dialog.getByRole("textbox", { name: "Label" }).fill("Book now");
  await dialog.getByRole("radio", { name: "Web address" }).click();
  await dialog.getByRole("textbox", { name: "Web address" }).fill("book.example");
  await dialog.getByRole("button", { name: "Save Link" }).click();
  await expect(rows()).toHaveText(["My site", "New page", "Book now"]);
  // The canvas's Header shows the menu as the export will (1.21).
  const canvasNav = page.frameLocator(".editor__canvas iframe").getByRole("navigation");
  await expect(canvasNav.getByRole("link")).toHaveText(["My site", "New page", "Book now"]);

  await menu().getByRole("button", { name: "Book now, button" }).focus();
  await page.keyboard.press("Alt+ArrowUp");
  await expect(rows()).toHaveText(["My site", "Book now", "New page"]);

  await menu()
    .getByRole("button", { name: "My site, page" })
    .dragTo(menu().getByRole("button", { name: "New page, page" }), {
      targetPosition: { x: 20, y: 18 },
    });
  await expect(rows()).toHaveText(["Book now", "New page", "My site"]);
  await expect(canvasNav.getByRole("link")).toHaveText(["Book now", "New page", "My site"]);
  await expect(steps()).toHaveText([
    "Moved menu item 'My site'",
    "Moved menu item 'Book now'",
    "Added menu item 'Book now'",
    "Added page 'New page'",
    "Opened page",
  ]);

  for (let step = 0; step < 3; step++) {
    await page.keyboard.press("ControlOrMeta+z");
  }
  await expect(rows()).toHaveText(["My site", "New page"]);
});
