import { type ElectronApplication, expect, type Locator, type Page, test } from "@playwright/test";
import { clickOnCanvas } from "./canvas-click.js";
import { type Box, below, boxOf, drag } from "./drag.js";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";

// Shared sections (1.29, F-ED-23): a section saved once and placed as linked copies; editing any
// copy changes them all in one undo step, and Detach makes one copy a normal section again.

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
const panel = () => page.getByRole("region", { name: "Right panels" });
const steps = () => page.locator(".undo-history__step");
const banner = () => page.locator(".editor > [role='status']");
const headings = () => canvas().locator(".site-heading");

/** Runs an Edit menu command, once the menu a previous command closed has gone. */
async function editMenu(name: string | RegExp): Promise<void> {
  await expect(page.getByRole("menu")).toHaveCount(0);
  await chooseFromMenu(app, page, "Edit", name);
}

/** Waits until `target` stays where it is: Puck animates the canvas, and redraws a saved section. */
async function settled(target: Locator): Promise<void> {
  let last = "";
  await expect
    .poll(async () => {
      const box = JSON.stringify(await target.boundingBox());
      const still = box === last;
      last = box;
      return still;
    })
    .toBe(true);
}

/**
 * Selects the first Section by clicking its bottom padding, once the canvas has finished resizing
 * to the device view (Puck animates it).
 */
async function selectSection(): Promise<void> {
  const section = canvas().locator(".site-section").first();
  await settled(section);
  const box = await section.boundingBox();
  if (box === null) throw new Error("Section not visible");
  await section.click({ force: true, position: { x: 10, y: box.height - 16 } });
  await expect(panel().getByRole("heading", { name: "Section", exact: true })).toBeVisible();
}

/** Selects heading `index` by clicking past the end of its text (clicking the text edits it). */
async function selectHeading(index: number): Promise<void> {
  const heading = headings().nth(index);
  const box = await heading.boundingBox();
  if (box === null) throw new Error("Heading not visible");
  await clickOnCanvas(heading, { position: { x: box.width * 0.97, y: box.height - 2 } });
  await expect(panel().getByRole("heading", { name: "Heading", exact: true })).toBeVisible();
}

test("saves a shared section, edits every copy at once, undoes it, and detaches one", async () => {
  await selectSection();
  await editMenu("Save as shared section…");
  const dialog = page.getByRole("dialog", { name: "Save as shared section" });
  await dialog.getByRole("textbox", { name: "Name" }).fill("Welcome");
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(steps().first()).toHaveText("Saved 'Welcome' as a shared section");
  await expect(banner()).toHaveText(
    "Editing shared section 'Welcome': changes apply to 1 copy on 1 page",
  );

  // Duplicating a copy places another linked copy.
  await editMenu("Duplicate");
  await expect(steps().first()).toHaveText("Added a copy of 'Welcome'");
  await expect(headings()).toHaveCount(2);
  await expect(banner()).toHaveText(
    "Editing shared section 'Welcome': changes apply to 2 copies on 1 page",
  );

  // An edit in the second copy shows in both, as one step.
  await selectHeading(1);
  await panel().getByLabel("Text", { exact: true }).fill("Opening hours");
  await expect(headings()).toHaveText(["Opening hours", "Opening hours"]);
  await expect(steps().first()).toHaveText("Edited shared section 'Welcome'");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(headings()).toHaveText(["Welcome to our business", "Welcome to our business"]);

  // Detached, the second copy is a normal section: its edits stay its own.
  await selectHeading(1);
  await editMenu("Detach from shared section");
  await expect(steps().first()).toHaveText("Detached 'Welcome'");
  await expect(banner()).toHaveCount(0);
  await selectHeading(1);
  await panel().getByLabel("Text", { exact: true }).fill("Only here");
  await expect(headings()).toHaveText(["Welcome to our business", "Only here"]);
  await expect(steps().first()).toHaveText("Edited Heading text");
});

test("Ctrl/Cmd+V pastes a copied linked copy as the page's own; Ctrl/Cmd+Shift+V places another linked copy (F-ED-23)", async () => {
  await selectSection();
  await editMenu("Save as shared section…");
  const dialog = page.getByRole("dialog", { name: "Save as shared section" });
  await dialog.getByRole("textbox", { name: "Name" }).fill("Welcome");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(banner()).toHaveText(
    "Editing shared section 'Welcome': changes apply to 1 copy on 1 page",
  );
  await settled(canvas().locator(".site-section").first());
  await selectSection();
  await page.keyboard.press("ControlOrMeta+c");

  await page.keyboard.press("ControlOrMeta+v");
  await expect(steps().first()).toHaveText("Pasted Section");
  await expect(headings()).toHaveCount(2);
  // The pasted section is the page's own: no banner for it.
  await expect(banner()).toHaveCount(0);

  await page.keyboard.press("ControlOrMeta+Shift+v");
  await expect(steps().first()).toHaveText("Added a copy of 'Welcome'");
  await expect(headings()).toHaveCount(3);
  await expect(banner()).toHaveText(
    "Editing shared section 'Welcome': changes apply to 2 copies on 1 page",
  );

  // An element isn't a shared section: nothing is pasted, and the reason is shown.
  await selectHeading(1);
  await page.keyboard.press("ControlOrMeta+c");
  await page.keyboard.press("ControlOrMeta+Shift+v");
  await expect(
    page.getByText("Only a shared section can be pasted as a linked copy."),
  ).toBeVisible();
  await expect(headings()).toHaveCount(3);
});

test("renames a shared section, then deletes it after asking, its copies staying", async () => {
  await selectSection();
  await editMenu("Save as shared section…");
  await page.getByRole("textbox", { name: "Name" }).fill("Welcome");
  await page.getByRole("button", { name: "Save" }).click();
  await editMenu("Duplicate");
  await expect(headings()).toHaveCount(2);

  await editMenu("Rename shared section…");
  const rename = page.getByRole("dialog", { name: "Rename shared section" });
  const name = rename.getByRole("textbox", { name: "Name" });
  // Its own name, in other capitals, is allowed (another section's isn't: unit tests).
  await name.fill("WELCOME ");
  await expect(rename.getByRole("button", { name: "Rename" })).toBeEnabled();
  await name.fill("Opening hours");
  await rename.getByRole("button", { name: "Rename" }).click();
  await expect(steps().first()).toHaveText("Renamed 'Welcome' to 'Opening hours'");
  await expect(banner()).toHaveText(
    "Editing shared section 'Opening hours': changes apply to 2 copies on 1 page",
  );

  // Deleting asks first (D7); its copies stay as normal sections.
  await editMenu("Delete shared section…");
  const ask = page.getByRole("alertdialog", { name: "Delete shared section 'Opening hours'?" });
  await expect(ask).toContainText("This changes 1 page.");
  await ask.getByRole("button", { name: "Delete Shared Section" }).click();
  await expect(ask).toHaveCount(0);
  await expect(steps().first()).toHaveText("Deleted shared section 'Opening hours'");
  await expect(banner()).toHaveCount(0);
  await expect(headings()).toHaveText(["Welcome to our business", "Welcome to our business"]);

  // Now normal sections: an edit in one stays in it.
  await selectHeading(1);
  await panel().getByLabel("Text", { exact: true }).fill("Only here");
  await expect(headings()).toHaveText(["Welcome to our business", "Only here"]);
  await page.keyboard.press("ControlOrMeta+z");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(banner()).toHaveText(
    "Editing shared section 'Opening hours': changes apply to 2 copies on 1 page",
  );
});

test("renames and deletes a shared section on no page from the Add panel, and undoes the delete", async () => {
  await selectSection();
  await editMenu("Save as shared section…");
  await page.getByRole("textbox", { name: "Name" }).fill("Welcome");
  await page.getByRole("button", { name: "Save" }).click();
  // Its only copy deleted: the shared section is on no page, so only the Add panel reaches it.
  await editMenu(/^Delete(?! shared)/);
  await expect(headings()).toHaveCount(0);

  const left = page.getByRole("region", { name: "Left panels" });
  await left.getByRole("tab", { name: "Add" }).click();
  const shared = left.getByRole("list", { name: "Shared sections" });
  await shared.getByRole("button", { name: "Actions for Welcome" }).click();
  await page.getByRole("menuitem", { name: "Rename…" }).click();
  const rename = page.getByRole("dialog", { name: "Rename shared section" });
  await expect(rename.getByRole("textbox", { name: "Name" })).toBeFocused();
  await rename.getByRole("textbox", { name: "Name" }).fill("Opening hours");
  await rename.getByRole("button", { name: "Rename" }).click();
  await expect(shared.getByRole("button", { name: "Opening hours", exact: true })).toBeVisible();

  // No page has a copy: nothing to ask (D7), and it goes in one step.
  await shared.getByRole("button", { name: "Actions for Opening hours" }).click();
  await page.getByRole("menuitem", { name: "Delete…" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(shared).toHaveCount(0);

  await editMenu("Undo");
  await expect(shared.getByRole("button", { name: "Opening hours", exact: true })).toBeVisible();
  await left.getByRole("tab", { name: "Undo History" }).click();
  await expect(steps()).toContainText([
    "Deleted shared section 'Opening hours'",
    "Renamed 'Welcome' to 'Opening hours'",
  ]);
});

/**
 * How far down a selected section to press in its left padding to drag it: above the padding grip
 * at the middle of its side, which a Wide section (3.21) has at the canvas's edge, where 1% of its
 * width falls.
 */
const GRAB_HEIGHT = 0.25;

/** A point in a section's left padding, near its bottom: on the section, not on what it holds. */
const padding = (box: Box, fromBottom = 6) => ({
  x: box.x + 6,
  y: box.y + box.height - fromBottom,
});

test("Ctrl/Cmd+Shift-drag of a copy places another linked copy; Ctrl/Cmd-drag a section of the page's own (1.30)", async () => {
  await selectSection();
  await editMenu("Save as shared section…");
  const dialog = page.getByRole("dialog", { name: "Save as shared section" });
  await dialog.getByRole("textbox", { name: "Name" }).fill("Welcome");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(steps().first()).toHaveText("Saved 'Welcome' as a shared section");
  const sections = canvas().locator(".site-section");
  const first = sections.first();
  // The section is shown again as a linked copy: grabbed only once it is drawn and still.
  await expect(banner()).toHaveText(
    "Editing shared section 'Welcome': changes apply to 1 copy on 1 page",
  );
  await settled(first);

  // Dragged with Ctrl/Cmd+Shift onto its own lower edge: another linked copy, after it.
  await page.keyboard.down("ControlOrMeta");
  await page.keyboard.down("Shift");
  await drag(page, first, padding(await boxOf(first, "Section")), 0.01, GRAB_HEIGHT);
  await page.keyboard.up("Shift");
  await page.keyboard.up("ControlOrMeta");
  await expect(steps().first()).toHaveText("Added a copy of 'Welcome'");
  await expect(headings()).toHaveCount(2);
  await expect(banner()).toHaveText(
    "Editing shared section 'Welcome': changes apply to 2 copies on 1 page",
  );

  // An element inside a copy can't be a linked copy: with Shift, its drag changes nothing.
  await page.keyboard.down("ControlOrMeta");
  await page.keyboard.down("Shift");
  await drag(
    page,
    headings().first(),
    await below(canvas().locator(".site-text").first(), -3),
    0.97,
  );
  await page.keyboard.up("Shift");
  await page.keyboard.up("ControlOrMeta");
  await expect(headings()).toHaveCount(2);
  await expect(steps().first()).toHaveText("Added a copy of 'Welcome'");

  // With Ctrl/Cmd alone: a section of the page's own, linked to nothing.
  const last = sections.last();
  await page.keyboard.down("ControlOrMeta");
  await drag(page, first, padding(await boxOf(last, "Section")), 0.01, GRAB_HEIGHT);
  await page.keyboard.up("ControlOrMeta");
  await expect(steps().first()).toHaveText("Duplicated Section");
  await expect(headings()).toHaveCount(3);
  await expect(banner()).toHaveCount(0);
});
