import { type ElectronApplication, expect, type Locator, type Page, test } from "@playwright/test";
import { launchDesktopApp } from "./launch.js";

// Phase 0 spike (spec/02-mvp-spec.md §6, ADR 0004): Puck runs on the canvas, but every change goes
// through Webforge's HistoryManager. Puck's own undo history must never act.

let app: ElectronApplication;
let page: Page;
const pageErrors: string[] = [];

const STARTER_HEADING = "Welcome to our business";
const STARTER_TEXT = "Tell visitors what you do and why they will love it.";

test.beforeEach(async () => {
  pageErrors.length = 0;
  app = await launchDesktopApp();
  page = await app.firstWindow();
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(message.text());
  });
  await expect(canvas().locator("h1")).toHaveText(STARTER_HEADING);
  // The site CSS changes the layout when it arrives; drags and clicks need the final positions.
  await expect(canvas().locator("style[data-webforge-site-css]")).toHaveCount(1);
});

test.afterEach(async () => {
  expect(pageErrors).toEqual([]);
  await app.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const steps = () => page.locator(".undo-history__step");
const currentStep = () => page.locator('.undo-history__step[aria-current="step"]');

/** Labels in the Undo History panel, newest first. */
async function expectSteps(labels: string[], current: string): Promise<void> {
  await expect(steps()).toHaveText([...labels, "Opened page"]);
  await expect(currentStep()).toHaveText(current);
  // Puck's own history would show up as an unexplained "Edited page" step (see editFromAction).
  await expect(page.getByText("Edited page")).toHaveCount(0);
}

type Box = { x: number; y: number; width: number; height: number };

/**
 * The element's position, once it has one. Puck swaps the rich-text element when its editor
 * finishes loading (ADR 0004), so a single read can land between the old and the new element.
 */
async function boxOf(target: Locator, name: string): Promise<Box> {
  let box: Box | null = null;
  await expect
    .poll(
      async () => {
        box = await target.boundingBox();
        return box !== null;
      },
      { message: `${name} is not visible` },
    )
    .toBe(true);
  return box as unknown as Box;
}

/**
 * Drags with real mouse events, in small steps, as a user would. `grabAt` is where to press, as a
 * fraction of the source's width: pressing on an inline-editable element's text selects text
 * instead of dragging the element.
 */
async function drag(from: Locator, to: { x: number; y: number }, grabAt = 0.5): Promise<void> {
  const box = await boxOf(from, "Drag source");
  const x = box.x + box.width * grabAt;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 10, y + 10, { steps: 5 });
  await page.mouse.move(to.x, to.y, { steps: 25 });
  await page.mouse.move(to.x, to.y + 1, { steps: 2 });
  await page.mouse.up();
}

async function below(target: Locator, offset = 3): Promise<{ x: number; y: number }> {
  const box = await boxOf(target, "Drop target");
  return { x: box.x + box.width / 2, y: box.y + box.height + offset };
}

/** Waits until the history's coalescing window (1 s) has passed, as a pause in typing would. */
async function pauseTyping(): Promise<void> {
  const start = await page.evaluate(() => Date.now());
  await expect.poll(() => page.evaluate(() => Date.now())).toBeGreaterThan(start + 1_200);
}

/** Moves focus out of the canvas iframe, so key presses go to the host window. */
async function focusHost(): Promise<void> {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
}

test.describe("Puck canvas with Webforge history", () => {
  test("hides Puck's own Undo and Redo buttons", async () => {
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toHaveCount(1);
    await expect(page.locator(".editor__canvas").getByTitle("Undo")).toHaveCount(0);
    await expect(page.locator(".editor__canvas").getByTitle("Redo")).toHaveCount(0);
  });

  test("adding an element by drag is one step; Ctrl+Z and Ctrl+Shift+Z undo and redo it", async () => {
    await drag(
      page.getByText("Heading", { exact: true }).first(),
      await below(canvas().getByText(STARTER_TEXT)),
    );

    await expectSteps(["Added Heading"], "Added Heading");
    await expect(canvas().locator("h2")).toHaveText("Heading");

    await focusHost();
    await page.keyboard.press("ControlOrMeta+z");
    await expect(canvas().locator("h2")).toHaveCount(0);
    await expect(currentStep()).toHaveText("Opened page");

    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect(canvas().locator("h2")).toHaveText("Heading");
    await expectSteps(["Added Heading"], "Added Heading");
  });

  test("moving an element by drag is one step", async () => {
    const heading = canvas().locator("h1");
    const text = canvas().getByText(STARTER_TEXT);

    // Grabbed past the end of its text, at the right of the heading, and dropped just inside the
    // text's lower edge: below it is the Section's padding, which isn't a drop zone.
    await drag(heading, await below(text, -3), 0.97);

    await expectSteps(["Moved Heading"], "Moved Heading");
    await expect(canvas().locator(".site-section")).toContainText(
      `${STARTER_TEXT}${STARTER_HEADING}`,
    );

    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(canvas().locator(".site-section")).toContainText(
      `${STARTER_HEADING}${STARTER_TEXT}`,
    );
    await expect(currentStep()).toHaveText("Opened page");
  });

  test("a text-editing session is one step, undoable word by word while it lasts", async () => {
    const field = canvas().locator("h1 [contenteditable]");
    // Puck makes the field editable only while it is hovered or focused.
    await field.hover();
    await expect(field).toHaveAttribute("contenteditable", "plaintext-only");
    await field.click();
    await expect(field).toBeFocused();
    await page.keyboard.press("End");
    await page.keyboard.type(" today", { delay: 20 });
    // Pause longer than the coalescing window: the next words become a separate chunk.
    await pauseTyping();
    await page.keyboard.type(" and", { delay: 20 });
    await expect(canvas().locator("h1")).toHaveText(`${STARTER_HEADING} today and`);

    // Inside the canvas, Ctrl+Z undoes the last chunk only (U5) and keeps the caret in place.
    await page.keyboard.press("ControlOrMeta+z");
    await expect(canvas().locator("h1")).toHaveText(`${STARTER_HEADING} today`);
    await page.keyboard.type("!", { delay: 20 });
    await expect(canvas().locator("h1")).toHaveText(`${STARTER_HEADING} today!`);

    // Selecting something else ends the session: the whole edit becomes one step (D1).
    // Near the text's start: the selected heading's action bar covers its middle.
    const textBox = await boxOf(canvas().getByText(STARTER_TEXT), "Text");
    await canvas()
      .getByText(STARTER_TEXT)
      .click({ force: true, position: { x: 10, y: textBox.height / 2 } });
    await expectSteps(["Edited Heading text"], "Edited Heading text");

    await focusHost();
    await page.keyboard.press("ControlOrMeta+z");
    await expect(canvas().locator("h1")).toHaveText(STARTER_HEADING);
    await expect(currentStep()).toHaveText("Opened page");
    // Undo shows what changed (U3): the heading is selected again.
    await expect(page.locator(".editor__canvas")).toContainText("Heading");

    await page.keyboard.press("ControlOrMeta+y");
    await expect(canvas().locator("h1")).toHaveText(`${STARTER_HEADING} today!`);
  });

  test("a rich-text session is one step", async () => {
    // The real Tiptap editor: Puck shows a fallback until its lazily loaded editor chunk arrives.
    const editor = canvas().locator(".site-text .ProseMirror");
    await canvas().getByText(STARTER_TEXT).click();
    await editor.click();
    await expect(editor).toBeFocused();
    await page.keyboard.press("End");
    await page.keyboard.type(" Really.", { delay: 20 });
    await expect(canvas().locator(".site-text")).toHaveText(`${STARTER_TEXT} Really.`);

    // Click away straight after typing: the first undo must still reach the editor (ADR 0004).
    await canvas().locator("h1").click({ force: true });
    await expectSteps(["Edited Text text"], "Edited Text text");

    await focusHost();
    await page.keyboard.press("ControlOrMeta+z");
    await expect(canvas().locator(".site-text")).toHaveText(STARTER_TEXT);
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect(canvas().locator(".site-text")).toHaveText(`${STARTER_TEXT} Really.`);
  });

  test("clicking a step in Undo History jumps there", async () => {
    await drag(
      page.getByText("Heading", { exact: true }).first(),
      await below(canvas().getByText(STARTER_TEXT)),
    );
    await expect(canvas().locator("h2")).toHaveCount(1);
    await drag(
      page.getByText("Text", { exact: true }).first(),
      await below(canvas().locator("h2")),
    );
    await expectSteps(["Added Text", "Added Heading"], "Added Text");

    await steps().filter({ hasText: "Opened page" }).click();
    await expect(canvas().locator("h2")).toHaveCount(0);
    await expect(canvas().locator(".site-text")).toHaveCount(1);

    await steps().filter({ hasText: "Added Text" }).click();
    await expect(canvas().locator("h2")).toHaveCount(1);
    await expect(canvas().locator(".site-text")).toHaveCount(2);
    await expectSteps(["Added Text", "Added Heading"], "Added Text");
  });
});
