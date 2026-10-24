import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, waitForCanvas } from "./launch.js";

// Shared sections in the panels (1.29, F-ED-23): the Add panel places linked copies, Layers marks
// them, and deleting inside a copy asks first, as it changes every copy (D7).

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  // Undo History is the left column's second tab, after Add.
  await left().getByRole("tab", { name: "Undo History" }).click();
  await waitForCanvas(page);
});

test.afterEach(async () => {
  await app.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const left = () => page.getByRole("region", { name: "Left panels" });
const panel = () => page.getByRole("region", { name: "Right panels" });
const steps = () => page.locator(".undo-history__step");
const headings = () => canvas().locator(".site-heading");
const confirmation = () => page.getByRole("alertdialog");

/** The Edit menu's Delete, not "Delete shared section…". */
const DELETE = /^Delete(?! shared)/;

/** Runs an Edit menu command. */
async function editMenu(name: string | RegExp): Promise<void> {
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await page.getByRole("menuitem", { name }).click();
}

/**
 * Selects the first Section by clicking its bottom padding, once the canvas has finished resizing
 * to the device view (Puck animates it).
 */
async function selectSection(): Promise<void> {
  const section = canvas().locator(".site-section").first();
  let last = "";
  await expect
    .poll(async () => {
      const box = JSON.stringify(await section.boundingBox());
      const settled = box === last;
      last = box;
      return settled;
    })
    .toBe(true);
  const box = await section.boundingBox();
  if (box === null) throw new Error("Section not visible");
  await section.click({ force: true, position: { x: 10, y: box.height - 16 } });
  await expect(panel().getByRole("heading", { name: "Section", exact: true })).toBeVisible();
}

/**
 * Deletes heading `index` through the Edit menu: a click on its text selects it (and edits it, so
 * the Delete key would go to the text).
 */
async function deleteHeading(index: number): Promise<void> {
  await headings().nth(index).click();
  await expect(panel().getByRole("heading", { name: "Heading", exact: true })).toBeVisible();
  await editMenu(DELETE);
}

test("places a copy from the Add panel, asks before deleting inside one, marks copies in Layers, and deletes whole copies without asking", async () => {
  await selectSection();
  await editMenu("Save as shared section…");
  const dialog = page.getByRole("dialog", { name: "Save as shared section" });
  await dialog.getByRole("textbox", { name: "Name" }).fill("Welcome");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(steps().first()).toHaveText("Saved 'Welcome' as a shared section");

  // The Add panel lists it first; a click places another linked copy after the selected one.
  await left().getByRole("tab", { name: "Add" }).click();
  await left()
    .getByRole("list", { name: "Shared sections" })
    .getByRole("button", { name: "Welcome", exact: true })
    .click();
  await expect(headings()).toHaveCount(2);
  await left().getByRole("tab", { name: "Undo History" }).click();
  await expect(steps().first()).toHaveText("Added a copy of 'Welcome'");

  // Deleting a Heading inside a copy deletes it from every copy: asked first.
  await deleteHeading(1);
  await expect(confirmation()).toHaveAccessibleName(
    "Delete Heading from the shared section 'Welcome'?",
  );
  await expect(confirmation()).toContainText(
    "All 2 copies of the section show the change. This changes 1 page.",
  );
  await confirmation().getByRole("button", { name: "Cancel" }).click();
  // Gone, not fading out: until then the canvas takes no clicks.
  await expect(confirmation()).toHaveCount(0);
  await expect(headings()).toHaveCount(2);

  await deleteHeading(1);
  await confirmation().getByRole("button", { name: "Delete" }).click();
  await expect(headings()).toHaveCount(0);

  await page.locator(".editor__canvas").focus();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(headings()).toHaveCount(2);

  // Layers marks both copies.
  const copies = () =>
    left()
      .getByRole("tree", { name: "Layers" })
      .getByRole("treeitem", { name: /^Linked copy of 'Welcome'/ });
  await expect(copies()).toHaveCount(2);

  // A whole copy goes from this page only, without the question: from Layers' Delete (the same
  // command as the Delete key and the Edit menu), then from the canvas's quick bar.
  await copies().first().click();
  await left()
    .getByRole("toolbar", { name: "Layer actions" })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(copies()).toHaveCount(1);
  await copies().first().click();
  await canvas()
    .locator("[data-puck-overlay]")
    .filter({ has: canvas().locator('.wf-outline[data-state="selected"]') })
    .locator('[title="Delete"]')
    .click();
  await expect(copies()).toHaveCount(0);
  await expect(confirmation()).toHaveCount(0);
  await expect(headings()).toHaveCount(0);
});
