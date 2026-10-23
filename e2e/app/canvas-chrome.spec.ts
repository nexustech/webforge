import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp } from "./launch.js";

// Selection chrome on the canvas (1.12): magenta outlines and the selected element's quick
// actions, each one labelled undo step.

let app: ElectronApplication;
let page: Page;

const STARTER_HEADING = "Welcome to our business";
const STARTER_TEXT = "Tell visitors what you do and why they will love it.";

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  // Undo History is the left column's second tab, after Add.
  await page
    .getByRole("region", { name: "Left panels" })
    .getByRole("tab", { name: "Undo History" })
    .click();
  await expect(canvas().locator("style[data-webforge-site-css]")).toHaveCount(1);
});

test.afterEach(async () => {
  await app.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const steps = () => page.locator(".undo-history__step");
/** A quick action of the selected element (a hovered element shows a bar of its own too). */
const quickAction = (title: string) =>
  canvas()
    .locator("[data-puck-overlay]")
    .filter({ has: canvas().locator('.wf-outline[data-state="selected"]') })
    .locator(`[title="${title}"]`);

/** The selected element's quick-action bar, which names it. */
const selectedBar = () =>
  canvas()
    .locator("[data-puck-overlay]")
    .filter({ has: canvas().locator('.wf-outline[data-state="selected"]') });

/**
 * Selects the heading by clicking past the end of its text (clicking the text edits it), at its
 * bottom edge: once it is selected, its quick actions sit over its top edge, below the Header.
 */
async function selectHeading(): Promise<void> {
  const heading = canvas().locator("h1");
  const box = await heading.boundingBox();
  if (box === null) throw new Error("Heading not visible");
  await heading.click({ position: { x: box.width * 0.97, y: box.height - 2 } });
  await expect(quickAction("Move down")).toBeVisible();
}

test.describe("selection chrome", () => {
  test("outlines the selected element in magenta", async () => {
    await selectHeading();

    const outline = canvas().locator('.wf-outline[data-state="selected"]');
    await expect(outline).toHaveCount(1);
    await expect(outline).toHaveCSS("outline-color", "rgb(240, 40, 243)");
    await expect(outline).toHaveCSS("outline-style", "solid");
  });

  test("moves, duplicates and deletes the selected element, one undo step each", async () => {
    await selectHeading();

    await quickAction("Move down").click();
    await expect(steps().first()).toHaveText("Moved Heading");
    await expect(canvas().locator(".site-section")).toContainText(
      `${STARTER_TEXT}${STARTER_HEADING}`,
    );

    await quickAction("Duplicate").click();
    await expect(steps().first()).toHaveText("Duplicated Heading");
    await expect(canvas().locator("h1")).toHaveCount(2);

    await quickAction("Delete").click();
    await expect(steps().first()).toHaveText("Deleted Heading");
    await expect(steps()).toHaveText([
      "Deleted Heading",
      "Duplicated Heading",
      "Moved Heading",
      "Opened page",
    ]);

    // The title bar's Undo: the delete's toast has an Undo button too (1.11).
    await page.getByRole("banner").getByRole("button", { name: "Undo", exact: true }).click();
    await expect(canvas().locator("h1")).toHaveCount(2);
  });
});

test.describe("keyboard and floating add", () => {
  test("arrows select, Alt+arrows move, Mod+D duplicates, Delete deletes; one step each", async () => {
    await selectHeading();

    await page.keyboard.press("ArrowDown");
    // The Text is selected now: its bar shows its label.
    await expect(quickAction("Move up")).toBeVisible();
    await page.keyboard.press("ControlOrMeta+Alt+ArrowUp");
    await expect(steps().first()).toHaveText("Moved Text");
    await expect(canvas().locator(".site-section")).toContainText(
      `${STARTER_TEXT}${STARTER_HEADING}`,
    );

    await page.keyboard.press("ControlOrMeta+d");
    await expect(steps().first()).toHaveText("Duplicated Text");
    await page.keyboard.press("Delete");
    await expect(steps()).toHaveText([
      "Deleted Text",
      "Duplicated Text",
      "Moved Text",
      "Opened page",
    ]);
  });

  test("leaves arrows and Delete to text being edited", async () => {
    const field = canvas().locator("h1 [contenteditable]");
    await field.hover();
    await field.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Delete");

    await expect(canvas().locator("h1")).toHaveText("Welcome to our busine");
    await expect(steps().first()).toHaveText("Edited Heading text");
  });

  test("Mod+arrows walk the page's tree: siblings, parent and first child (1.30)", async () => {
    await selectHeading();

    await page.keyboard.press("ControlOrMeta+ArrowRight");
    await expect(selectedBar()).toContainText("Text");
    await page.keyboard.press("ControlOrMeta+ArrowLeft");
    await expect(selectedBar()).toContainText("Heading");
    await page.keyboard.press("ControlOrMeta+ArrowUp");
    await expect(selectedBar()).toContainText("Section");
    await page.keyboard.press("ControlOrMeta+ArrowDown");
    await expect(selectedBar()).toContainText("Heading");
    // Walking selects only: no undo steps.
    await expect(steps()).toHaveText(["Opened page"]);
  });

  test("Enter edits the selected element's text; Backspace empties it first (1.30)", async () => {
    await selectHeading();
    await page.keyboard.press("Enter");
    await page.keyboard.type(" today");
    await expect(canvas().locator("h1")).toHaveText(`${STARTER_HEADING} today`);

    await selectHeading();
    await page.keyboard.press("Backspace");
    await page.keyboard.type("Fresh bread");

    await expect(canvas().locator("h1")).toHaveText("Fresh bread");
    await expect(steps().first()).toHaveText("Edited Heading text");
  });

  test("Backspace deletes an element with no text of its own; Mod+Backspace deletes any (1.30)", async () => {
    await selectHeading();
    await page.keyboard.press("ControlOrMeta+ArrowUp");
    await expect(selectedBar()).toContainText("Section");

    // A Mac's delete key is Backspace: a Section has no text to empty, so it goes.
    await page.keyboard.press("Backspace");
    await expect(steps().first()).toHaveText("Deleted Section");
    await expect(canvas().locator("h1")).toHaveCount(0);
    await page.getByRole("banner").getByRole("button", { name: "Undo", exact: true }).click();
    await expect(canvas().locator("h1")).toHaveCount(1);

    await selectHeading();
    await page.keyboard.press("ControlOrMeta+Backspace");
    await expect(steps().first()).toHaveText("Deleted Heading");
    await expect(canvas().locator("h1")).toHaveCount(0);
  });

  test("never deletes the element whose rich text is being edited (1.30)", async () => {
    const text = canvas().locator(".site-text");
    const editor = text.locator(".ProseMirror");
    await canvas().getByText(STARTER_TEXT).click();
    await editor.click();
    await expect(editor).toBeFocused();
    await page.keyboard.press("End");

    // Backspace deletes a letter, Mod+Backspace a word (on macOS, to the line's start), Delete
    // nothing at the end: all of them the text's.
    await page.keyboard.press("Backspace");
    await expect(text).toHaveText("Tell visitors what you do and why they will love it");
    await page.keyboard.press("ControlOrMeta+Backspace");
    await page.keyboard.press("Delete");

    await expect(text).toHaveCount(1);
    await expect(text).not.toHaveText(/love it$/);
    await expect(steps().first()).toHaveText("Edited Text text");
    await expect(steps()).not.toContainText(["Deleted Text"]);
  });

  test("Mod+/ and the chip hide and show the selected element; Edit edits its text (1.30)", async () => {
    await selectHeading();

    await page.keyboard.press("ControlOrMeta+/");
    await expect(steps().first()).toHaveText("Hid Heading");
    await expect(canvas().locator("h1[data-webforge-hidden]")).toHaveCount(1);
    await quickAction("Show").click();
    await expect(steps().first()).toHaveText("Showed Heading");
    await quickAction("Hide").click();
    await expect(steps()).toHaveText([
      "Hid Heading",
      "Showed Heading",
      "Hid Heading",
      "Opened page",
    ]);

    await quickAction("Edit").click();
    await page.keyboard.type("!");
    await expect(canvas().locator("h1")).toHaveText(`${STARTER_HEADING}!`);
  });

  test("adds a section with the floating + below a section, chosen in the Add panel", async () => {
    const section = canvas().locator(".site-section");
    const box = await section.boundingBox();
    if (box === null) throw new Error("Section not visible");
    // The Section's bottom padding selects the Section itself.
    await section.click({ force: true, position: { x: 10, y: box.height - 4 } });

    await canvas().getByTitle("Add a section here").click();
    await page
      .getByRole("region", { name: "Left panels" })
      .getByRole("button", { name: "Section", exact: true })
      .click();
    await page
      .getByRole("region", { name: "Left panels" })
      .getByRole("tab", { name: "Undo History" })
      .click();

    await expect(steps().first()).toHaveText("Added Section");
    await expect(canvas().locator(".site-section")).toHaveCount(2);
  });
});
