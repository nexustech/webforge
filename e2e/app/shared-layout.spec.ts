import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { clickOnCanvas } from "./canvas-click.js";
import { placeCaret } from "./caret.js";
import { drag, lowerHalf } from "./drag.js";
import { launchDesktopApp, waitForCanvas } from "./launch.js";

// The shared Header and Footer (1.20, F-ED-7, C5): stored once, shown on every page; an edit on one
// page shows on all of them, and one undo reverts it everywhere.

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  // Undo History is the left column's second tab, after Add.
  await page
    .getByRole("region", { name: "Left panels" })
    .getByRole("tab", { name: "Undo History" })
    .click();
  await waitForCanvas(page);
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

  const field = footer().locator("[contenteditable]");
  // Puck makes the field editable only while it is hovered or focused.
  await field.hover();
  await expect(field).toHaveAttribute("contenteditable", "plaintext-only");
  await field.click();
  await expect(field).toBeFocused();
  await placeCaret(field, "end");
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

test("starts the Footer from Full, adds to a column from the Add panel, on every page (HF-4, 5.39)", async () => {
  await page.getByRole("radio", { name: "Design", exact: true }).click();
  // Its edge, not its text: clicking the text edits it.
  await clickOnCanvas(canvas().locator(".site-footer"), { position: { x: 4, y: 4 } });
  const toolbar = page.getByRole("toolbar", { name: "Selected element" });
  await toolbar
    .getByRole("group", { name: "Start from" })
    .getByRole("button", { name: "Full" })
    .click();
  const columns = canvas().locator(".site-footer-column");
  await expect(columns).toHaveCount(3);
  await expect(
    columns.first().getByRole("navigation", { name: "Footer navigation" }),
  ).toBeVisible();
  await expect(steps().first()).toHaveText("Started the Footer from 'Full'");

  // A Heading dragged from the Add panel onto the menu's links' lower edge, into their column.
  const left = page.getByRole("region", { name: "Left panels" });
  await left.getByRole("tab", { name: "Add" }).click();
  await left.getByRole("tab", { name: "Elements" }).click();
  // With the Footer still selected, the line saying a change reaches every page stays while the
  // drag is under way, so the canvas doesn't move under the pointer (#1336). The Footer is at the
  // bottom of the page: in view first, so the pointer can reach it. The drag lets go only once the
  // drop preview is in that column, not where the pointer passed on its way (#1336).
  const banner = page.locator(".editor > [role='status']");
  await expect(banner).toContainText("Footer");
  const links = columns.first().getByRole("navigation", { name: "Footer navigation" });
  await links.scrollIntoViewIfNeeded();
  await drag(
    page,
    left.getByRole("button", { name: "Heading", exact: true }),
    () => lowerHalf(links),
    0.5,
    0.5,
    columns.first(),
  );
  await expect(banner).toContainText("Footer");
  await expect(columns.first().locator(".site-heading")).toHaveCount(2);

  // Opening hours and contact in the second column, in its column form: selected by its title,
  // a Text goes in after it, by keyboard from the Add panel.
  await clickOnCanvas(columns.nth(1).locator("h3").first());
  // Under Suggested too, as what a Footer column takes (SP-12): the first of the two.
  await left.getByRole("button", { name: "Text", exact: true }).first().focus();
  await page.keyboard.press("Enter");
  await expect(columns.nth(1).locator(".site-text")).toHaveCount(1);

  await showPage("Page not found");
  await expect(canvas().locator(".site-footer-column")).toHaveCount(3);
  await expect(canvas().locator(".site-footer-column").nth(1).locator(".site-text")).toHaveCount(1);
  await left.getByRole("tab", { name: "Undo History" }).click();
  await expect(steps().first()).toHaveText("Added shared Text");
});

test("says how far a change reaches, edits the Footer in the Edit panel, and hides it on one page", async () => {
  const banner = page.locator(".editor > [role='status']");
  await expect(banner).toHaveCount(0);

  // Its edge, not its text: clicking the text edits it.
  await clickOnCanvas(canvas().locator(".site-footer"), { position: { x: 4, y: 4 } });
  await expect(banner).toHaveText("Editing shared Footer: changes apply to all 2 pages");
  const panel = page.getByRole("region", { name: "Right panels" });
  await panel.getByRole("textbox", { name: "Text" }).fill("See you soon");
  await expect(footer()).toHaveText("See you soon");
  await expect(steps().first()).toHaveText("Edited shared Footer text");

  await panel.getByRole("tab", { name: "Site" }).click();
  await panel
    .getByRole("list", { name: "Pages" })
    .getByRole("button", { name: "Actions for My site" })
    .click();
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
