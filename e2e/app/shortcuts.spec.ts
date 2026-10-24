import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { placeCaret } from "./caret.js";
import { launchDesktopApp } from "./launch.js";

// The keyboard shortcut standard (1.38, F-ED-27): the sheet from the Help menu and `?`, the view
// keys, Electron's own zoom keys gone, and no shortcut taking keys from text being typed.

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

const mac = process.platform === "darwin";
const canvas = () => page.frameLocator(".editor__canvas iframe");
const toolbar = () => page.getByRole("toolbar", { name: "Canvas" });
const sheet = () => page.getByRole("dialog", { name: "Keyboard Shortcuts" });
const palette = () => page.getByRole("dialog", { name: "Commands" });
const panel = () => page.getByRole("region", { name: "Right panels" });
const device = (name: "Desktop" | "Tablet" | "Mobile") => toolbar().getByRole("radio", { name });
/** The whole window's zoom, which Electron's default menu changed on Ctrl/Cmd + = and −. */
const windowZoom = () =>
  app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.webContents.getZoomFactor(),
  );

/** Selects the heading by clicking past the end of its text (clicking the text edits it). */
async function selectHeading(): Promise<void> {
  const heading = canvas().locator(".site-heading");
  const box = await heading.boundingBox();
  if (box === null) throw new Error("Heading not visible");
  await heading.click({ position: { x: box.width * 0.97, y: box.height - 2 } });
}

test("lists every shortcut in a sheet, from the Help menu and from ?", async () => {
  await page.getByRole("menuitem", { name: "Help" }).click();
  await page.getByRole("menuitem", { name: /^Keyboard Shortcuts/ }).click();

  await expect(sheet()).toBeVisible();
  const editing = sheet().getByRole("region", { name: "Editing" });
  await expect(editing.getByText("Duplicate", { exact: true })).toBeVisible();
  await expect(editing.locator("dd").filter({ hasText: mac ? "⌘D" : "Ctrl+D" })).toHaveCount(1);
  // A Mac keyboard has no Delete key: the sheet shows Cmd+Backspace there.
  await expect(
    editing
      .locator("dd")
      .filter({ hasText: mac ? "⌘⌫" : "Ctrl+Backspace" })
      .first(),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet()).toBeHidden();

  await page.keyboard.press("Shift+Slash");
  await expect(sheet()).toBeVisible();
});

test("switches device views and zooms the canvas from the keyboard, not the window", async () => {
  const zoom = toolbar().getByRole("combobox", { name: "Zoom" });
  await expect(toolbar().getByText(/^1280 × \d+ @ \d+%$/)).toBeVisible();

  await page.keyboard.press("ControlOrMeta+2");
  await expect(device("Tablet")).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("ControlOrMeta+3");
  await expect(device("Mobile")).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("ControlOrMeta+1");
  await expect(device("Desktop")).toHaveAttribute("aria-checked", "true");

  await page.keyboard.press("ControlOrMeta+0");
  await expect(zoom).toHaveValue("1");
  await page.keyboard.press("ControlOrMeta+Minus");
  await expect(zoom).toHaveValue("0.75");
  await page.keyboard.press("ControlOrMeta+Equal");
  await expect(zoom).toHaveValue("1");
  // Ctrl/Cmd + Shift + = makes +, as people press it for "zoom in".
  await page.keyboard.press("ControlOrMeta+Shift+Equal");
  await expect(zoom).toHaveValue("1.5");
  await page.keyboard.press("ControlOrMeta+9");
  await expect(zoom).toHaveValue("fit");

  expect(await windowZoom()).toBe(1);
});

test("leaves keys to a text field being typed in, except the app's own Mod keys", async () => {
  await selectHeading();
  const field = panel().getByLabel("Text", { exact: true });
  await field.click();
  await placeCaret(field, "end");

  // ?, Backspace and the arrows are the field's.
  await page.keyboard.type(" now?", { delay: 20 });
  await page.keyboard.press("Backspace");
  await page.keyboard.press("ArrowLeft");
  await expect(field).toHaveValue("Welcome to our business now");
  await expect(sheet()).toBeHidden();
  await expect(canvas().locator(".site-heading")).toHaveCount(1);
  // Mod+K is text's (a link in rich text): only Mod+P opens the palette here.
  await page.keyboard.press("ControlOrMeta+k");
  await expect(palette()).toBeHidden();
  await page.keyboard.press("ControlOrMeta+p");
  await expect(palette()).toBeVisible();
});

test("leaves ? to rich text edited on the canvas, where Mod+K links", async () => {
  const text = canvas().getByText("Tell visitors what you do and why they will love it.");
  const editor = canvas().locator(".site-text .ProseMirror");
  // Clicking the text edits it (F-ED-3).
  await text.click();
  await editor.click();
  await placeCaret(editor, "end");

  await page.keyboard.type("?", { delay: 20 });
  await page.keyboard.press("ControlOrMeta+k");

  await expect(editor).toContainText("love it.?");
  await expect(sheet()).toBeHidden();
  await expect(palette()).toBeHidden();
});

test("in rich text: Mod+K links, Shift+Space types a non-breaking space, Alt+Enter splits the element", async () => {
  const text = canvas().getByText("Tell visitors what you do and why they will love it.");
  const editor = canvas().locator(".site-text .ProseMirror");
  await text.click();
  await editor.click();

  // Mod+K with a word selected asks for the link, as the toolbar's Link… does.
  await placeCaret(editor, "end");
  await page.keyboard.press("Shift+ControlOrMeta+ArrowLeft");
  // Once the editor has the selection: the toolbar's Link… turns on with it.
  await expect(
    canvas().locator("[data-puck-rte-menu]").getByRole("button", { name: "Link…" }),
  ).toBeEnabled();
  await page.keyboard.press("ControlOrMeta+k");
  const link = page.getByRole("dialog", { name: "Link" });
  await expect(link).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(link).toHaveCount(0);

  await editor.click();
  await placeCaret(editor, "start");
  await page.keyboard.type("Open", { delay: 20 });
  await page.keyboard.press("Shift+Space");
  await expect(editor).toContainText("Open Tell visitors");

  // Split just before "Tell": one step, the second half in an element of its own.
  await page.keyboard.press("Alt+Enter");
  await expect(canvas().locator(".site-text")).toHaveCount(2);
  await expect(canvas().locator(".site-text").first()).toHaveText("Open ");
  await expect(canvas().locator(".site-text").nth(1)).toHaveText(
    "Tell visitors what you do and why they will love it.",
  );
  await page.keyboard.press("Escape");
  // The first editor, left, keeps its half: it doesn't write its old text back.
  await expect(canvas().locator(".site-text").first()).toHaveText("Open\u00a0");
  const left = page.getByRole("region", { name: "Left panels" });
  await left.getByRole("tab", { name: "Undo History" }).click();
  await expect(page.locator(".undo-history__step").first()).toHaveText("Split Text");

  // One step: undo joins it again, with what was typed.
  await page.keyboard.press("ControlOrMeta+z");
  await expect(canvas().locator(".site-text")).toHaveCount(1);
  await expect(canvas().locator(".site-text")).toHaveText(
    "Open\u00a0Tell visitors what you do and why they will love it.",
  );
});
