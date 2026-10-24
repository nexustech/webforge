import { type ElectronApplication, expect, type Locator, type Page, test } from "@playwright/test";
import { placeCaret } from "./caret.js";
import { below, boxOf, drag, lowerHalf } from "./drag.js";
import { launchDesktopApp, waitForCanvas } from "./launch.js";

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
  // Undo History is the left column's second tab, after Add.
  await page
    .getByRole("region", { name: "Left panels" })
    .getByRole("tab", { name: "Undo History" })
    .click();
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(message.text());
  });
  await expect(canvas().locator("h1")).toHaveText(STARTER_HEADING);
  // The site CSS changes the layout when it arrives; drags and clicks need the final positions.
  await waitForCanvas(page);
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

/** Waits until the history's coalescing window (1 s) has passed, as a pause in typing would. */
async function pauseTyping(): Promise<void> {
  const start = await page.evaluate(() => Date.now());
  await expect.poll(() => page.evaluate(() => Date.now())).toBeGreaterThan(start + 1_200);
}

const left = () => page.getByRole("region", { name: "Left panels" });

/** The Add panel's element `name`, on its Elements tab (1.13), to drag onto the canvas. */
async function addPanelElement(name: string): Promise<Locator> {
  await left().getByRole("tab", { name: "Add" }).click();
  await left().getByRole("tab", { name: "Elements" }).click();
  const item = left().getByRole("button", { name, exact: true });
  // The canvas adds its drag handle to a newly shown item a moment later.
  await expect(item.locator("[data-puck-drawer-item]").first()).toBeAttached();
  return item;
}

/** Brings Undo History, the left column's second tab, back to the front. */
async function showUndoHistory(): Promise<void> {
  await left().getByRole("tab", { name: "Undo History" }).click();
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
      page,
      await addPanelElement("Heading"),
      await lowerHalf(canvas().getByText(STARTER_TEXT)),
    );
    await showUndoHistory();

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
    await drag(page, heading, await below(text, -3), 0.97);

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

  test("a drag with Ctrl/Cmd held copies the element where it is dropped, one step (1.30)", async () => {
    const heading = canvas().locator("h1");
    const text = canvas().getByText(STARTER_TEXT);

    await page.keyboard.down("ControlOrMeta");
    await drag(page, heading, await below(text, -3), 0.97);
    await page.keyboard.up("ControlOrMeta");

    // The original stays; the copy is where it was dropped, selected.
    await expectSteps(["Duplicated Heading"], "Duplicated Heading");
    await expect(canvas().locator(".site-section")).toContainText(
      `${STARTER_HEADING}${STARTER_TEXT}${STARTER_HEADING}`,
    );
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(canvas().locator("h1")).toHaveCount(1);
  });

  test("a text-editing session is one step, undoable word by word while it lasts", async () => {
    const field = canvas().locator("h1 [contenteditable]");
    // Puck makes the field editable only while it is hovered or focused.
    await field.hover();
    await expect(field).toHaveAttribute("contenteditable", "plaintext-only");
    await field.click();
    await expect(field).toBeFocused();
    await placeCaret(field, "end");
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
    // The Section's bottom padding: the selected heading's action bar may cover the text.
    const section = canvas().locator(".site-section");
    const sectionBox = await boxOf(section, "Section");
    await section.click({ force: true, position: { x: 10, y: sectionBox.height - 4 } });
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
    await placeCaret(editor, "end");
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

  test("undoes all of a rich-text session with Ctrl/Cmd+Z pressed straight after typing (#146)", async () => {
    const editor = canvas().locator(".site-text .ProseMirror");
    await canvas().getByText(STARTER_TEXT).click();
    await editor.click();
    await expect(editor).toBeFocused();
    await placeCaret(editor, "end");
    await page.keyboard.type(" Indeed.", { delay: 20 });

    // Still in the editor, before Puck has sent the last keystrokes on: they belong to this step.
    await page.keyboard.press("ControlOrMeta+z");

    await expect(canvas().locator(".site-text")).toHaveText(STARTER_TEXT);
    await expectSteps(["Edited Text text"], "Opened page");
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect(canvas().locator(".site-text")).toHaveText(`${STARTER_TEXT} Indeed.`);
  });

  test("undoes and redoes all of the typing on a busy computer too (#307)", async () => {
    const editor = canvas().locator(".site-text .ProseMirror");
    await canvas().getByText(STARTER_TEXT).click();
    await editor.click();
    await expect(editor).toBeFocused();
    await placeCaret(editor, "end");
    // A busy computer (CI on Windows): React gets round to its scheduled work (posted to a
    // MessagePort) a second late, longer than Undo waits for the keystrokes Puck still holds back
    // (500 ms). The typing itself keeps its pace.
    await page.evaluate(() => {
      const post = MessagePort.prototype.postMessage;
      const late = function (this: MessagePort, message: unknown) {
        setTimeout(() => post.call(this, message), 1_000);
      };
      MessagePort.prototype.postMessage = late as MessagePort["postMessage"];
      (window as { restorePostMessage?: () => void }).restorePostMessage = () => {
        MessagePort.prototype.postMessage = post;
      };
    });
    try {
      await page.keyboard.type(" Indeed.", { delay: 20 });
      // Puck has passed the last keystrokes on (after 50 ms), but React hasn't rendered them yet.
      await new Promise((resolve) => setTimeout(resolve, 300));
      await page.keyboard.press("ControlOrMeta+z");
      await expect(canvas().locator(".site-text")).toHaveText(STARTER_TEXT);
    } finally {
      await page.evaluate(() =>
        (window as { restorePostMessage?: () => void }).restorePostMessage?.(),
      );
    }

    await expectSteps(["Edited Text text"], "Opened page");
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect(canvas().locator(".site-text")).toHaveText(`${STARTER_TEXT} Indeed.`);
  });

  test("runs a second Ctrl/Cmd+Z after the first when both follow typing at once", async () => {
    // An earlier step: the heading made smaller in the Edit panel.
    const heading = canvas().locator("h1");
    const box = await heading.boundingBox();
    if (box === null) throw new Error("Heading not visible");
    await heading.click({ position: { x: box.width * 0.97, y: 2 } });
    const panel = page.getByRole("region", { name: "Right panels" });
    await panel.getByRole("tab", { name: "Style" }).click();
    await panel.getByLabel("Size", { exact: true }).selectOption("small");
    await expect(canvas().locator("h3")).toHaveCount(1);
    // Select the Section (its bottom padding), so the heading's quick actions don't cover the text.
    const section = canvas().locator(".site-section");
    const sectionBox = await section.boundingBox();
    if (sectionBox === null) throw new Error("Section not visible");
    await section.click({ force: true, position: { x: 10, y: sectionBox.height - 4 } });

    const editor = canvas().locator(".site-text .ProseMirror");
    await canvas().getByText(STARTER_TEXT).click();
    await editor.click();
    await expect(editor).toBeFocused();
    await placeCaret(editor, "end");
    await page.keyboard.type(" Indeed.", { delay: 20 });
    await page.keyboard.press("ControlOrMeta+z");
    await page.keyboard.press("ControlOrMeta+z");

    // Both undone, in order: the typing, then the heading.
    await expect(canvas().locator(".site-text")).toHaveText(STARTER_TEXT);
    await expect(canvas().locator("h1")).toHaveText(STARTER_HEADING);
    await expect(currentStep()).toHaveText("Opened page");
  });

  test("clicking a step in Undo History jumps there", async () => {
    await drag(
      page,
      await addPanelElement("Heading"),
      await lowerHalf(canvas().getByText(STARTER_TEXT)),
    );
    await expect(canvas().locator("h2")).toHaveCount(1);
    await drag(page, await addPanelElement("Text"), await lowerHalf(canvas().locator("h2")));
    await showUndoHistory();
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
