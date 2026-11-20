import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, waitForCanvas } from "./launch.js";

// Click text and type (LF-17, #1178, the UX/UI review's F6): with an element selected whose own
// content is text, typing a character starts editing it with that character, a second click on its
// text places the caret there, and Enter in Layers edits it too. Single-key shortcuts still work on
// an element with no text of its own.

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  await waitForCanvas(page);
  await expect(canvas().locator("h1")).toHaveText("Welcome to our business");
  // A Hero after the starter page's Section: its heading is its own text.
  await left().getByRole("tab", { name: "Add", exact: true }).click();
  await left().getByRole("tab", { name: "Sections" }).click();
  await left()
    .getByRole("list", { name: "All sections" })
    .getByRole("button", { name: "Hero" })
    .click();
  await expect(heroHeading()).toHaveText("Fresh ideas, made by hand");
});

test.afterEach(async () => {
  await app?.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const left = () => page.getByRole("region", { name: "Left panels" });
const right = () => page.getByRole("region", { name: "Right panels" });
const heroHeading = () => canvas().locator(".site-hero h1, .site-hero h2").first();
const steps = () => page.locator(".undo-history__step");
const sheet = () => page.getByRole("dialog", { name: "Keyboard Shortcuts" });
/** The selected element's bar on the canvas (Puck's action bar). */
const actionBar = () => canvas().locator('[class*="_ActionBar_"]').first();

/**
 * Selects the Hero by a click on its own space, away from its text: nothing takes typing yet. The
 * click lands on Puck's overlay over the section, as a person's does, so it's forced past
 * Playwright's check that nothing covers the section.
 */
async function selectHeroAwayFromText() {
  await canvas()
    .locator(".site-hero")
    .click({ position: { x: 8, y: 8 }, force: true });
  await expect(right().getByRole("heading", { name: "Hero", exact: true })).toBeVisible();
  // The canvas has drawn the selection, as someone sees it before typing.
  await expect(actionBar()).toBeVisible();
  await expect
    .poll(() =>
      canvas()
        .locator("body")
        .evaluate(
          (body) =>
            (body.ownerDocument.activeElement as HTMLElement | null)?.isContentEditable === true,
        ),
    )
    .toBe(false);
}

/** Whether the canvas's focus is in the Hero's heading. */
const editingHeading = () =>
  heroHeading().evaluate((heading) => heading.contains(heading.ownerDocument.activeElement));

test("types a letter into the selected element's text, as one undo step", async () => {
  await left().getByRole("tab", { name: "Undo History" }).click();
  const before = await steps().count();
  await selectHeroAwayFromText();

  await page.keyboard.type("!", { delay: 20 });
  await expect(heroHeading()).toHaveText("Fresh ideas, made by hand!");
  await page.keyboard.type(" Daily", { delay: 20 });
  await expect(heroHeading()).toHaveText("Fresh ideas, made by hand! Daily");
  await page.keyboard.press("Escape");

  // The first character and what follows it before the pause: one step, as typing's always is.
  await expect(steps()).toHaveCount(before + 1);
  await expect(steps().first()).toHaveText("Edited Hero title");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(heroHeading()).toHaveText("Fresh ideas, made by hand");
});

test("types ? into selected text, and keeps ? for the shortcuts on a Section", async () => {
  await selectHeroAwayFromText();
  await page.keyboard.press("Shift+Slash");
  await expect(heroHeading()).toHaveText("Fresh ideas, made by hand?");
  await expect(sheet()).toBeHidden();
  await page.keyboard.press("Escape");

  // The starter page's Section has no text of its own: its Heading and Text are inside it.
  await canvas()
    .locator(".site-section")
    .first()
    .click({ position: { x: 8, y: 8 }, force: true });
  await expect(right().getByRole("heading", { name: "Section", exact: true })).toBeVisible();
  await expect(actionBar()).toBeVisible();
  await page.keyboard.press("Shift+Slash");
  await expect(sheet()).toBeVisible();
});

test("types into a selected Text's rich text, chosen from the keyboard", async () => {
  await left().getByRole("tab", { name: "Undo History" }).click();
  const before = await steps().count();
  // The starter Section, then its first element (the Heading) and the one beside it (the Text).
  await canvas()
    .locator(".site-section")
    .first()
    .click({ position: { x: 8, y: 8 }, force: true });
  await page.keyboard.press("ControlOrMeta+ArrowDown");
  await page.keyboard.press("ControlOrMeta+ArrowRight");
  await expect(right().getByRole("heading", { name: "Text", exact: true })).toBeVisible();

  await page.keyboard.type(" Open daily.", { delay: 20 });
  // A space starts nothing: the text starts with the O.
  await expect(canvas().locator(".site-text")).toHaveText(
    "Tell visitors what you do and why they will love it.Open daily.",
  );
  await page.keyboard.press("Escape");
  await expect(steps()).toHaveCount(before + 1);
  await expect(steps().first()).toHaveText("Edited Text text");
});

test("starts editing with an input method's composition, as with a letter", async () => {
  await selectHeroAwayFromText();
  // As Japanese input does: the first key reports "Process", then the composition goes on in
  // what has the focus, and is committed.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    key: "Process",
    code: "KeyN",
    windowsVirtualKeyCode: 229,
  });
  await cdp.send("Input.imeSetComposition", { text: "に", selectionStart: 1, selectionEnd: 1 });
  await cdp.send("Input.insertText", { text: "日本" });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Process", code: "KeyN" });
  await expect(heroHeading()).toHaveText("Fresh ideas, made by hand日本");
});

test("places the caret with a second click on the selected element's text", async () => {
  await selectHeroAwayFromText();
  await heroHeading().click();
  await expect.poll(editingHeading).toBe(true);
  // To the end of the whole text: End alone goes to the end of its line, and the heading wraps
  // onto two lines with Windows' fonts.
  await page.keyboard.press(process.platform === "darwin" ? "Meta+ArrowDown" : "Control+End");
  await page.keyboard.type("!", { delay: 20 });
  await expect(heroHeading()).toHaveText("Fresh ideas, made by hand!");
});

test("edits the selected layer's text with Enter in Layers", async () => {
  await left().getByRole("tab", { name: "Layers" }).click();
  const hero = left()
    .getByRole("tree", { name: "Layers" })
    .getByRole("treeitem", { name: /^Hero/ });
  await hero.click();
  await expect(hero).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("Enter");
  await expect.poll(editingHeading).toBe(true);
  await page.keyboard.type("!", { delay: 20 });
  await expect(heroHeading()).toHaveText("Fresh ideas, made by hand!");
});
