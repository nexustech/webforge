import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp } from "./launch.js";

// Rich text on the canvas (1.23, F-ED-3): the format toolbar offers only the formatting a site
// may have, and text pasted from Word or a web page keeps only that formatting.

const STARTER_TEXT = "Tell visitors what you do and why they will love it.";

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
const editor = () => canvas().locator(".site-text .ProseMirror");
const steps = () => page.locator(".undo-history__step");

/** Puts the caret in the starter text, in the real Tiptap editor. */
async function editText(): Promise<void> {
  await canvas().getByText(STARTER_TEXT).click();
  await editor().click();
  await expect(editor()).toBeFocused();
}

test("formats rich text from its toolbar, which offers only the site's formatting", async () => {
  await editText();
  const toolbar = canvas().locator("[data-puck-rte-menu]");
  for (const name of [
    "Bold",
    "Italic",
    "Bulleted list",
    "Numbered list",
    "Align left",
    "Align centre",
    "Align right",
  ]) {
    await expect(toolbar.getByRole("button", { name })).toBeVisible();
  }
  for (const name of ["Underline", "Strikethrough", "Quote", "Code"]) {
    await expect(toolbar.getByRole("button", { name })).toHaveCount(0);
  }

  await page.keyboard.press("ControlOrMeta+a");
  await toolbar.getByRole("button", { name: "Bold" }).click();
  await toolbar.getByRole("button", { name: "Align centre" }).click();

  await expect(editor().locator("strong")).toHaveText(STARTER_TEXT);
  await expect(editor().locator("p")).toHaveCSS("text-align", "center");
  await canvas().locator("h1").click({ force: true });
  await expect(steps().first()).toHaveText("Edited Text text");
});

test("keeps only the site's formatting in text pasted from Word or a web page", async () => {
  const pasted =
    '<h1 style="color: red">Opening hours</h1>' +
    '<p class="MsoNormal"><span style="font-family: Comic Sans MS; font-size: 20pt">' +
    "<b>Monday</b> to <i>Friday</i> <u>only</u></span></p>" +
    '<table><tr><td>9am</td><td>5pm</td></tr></table><img src="https://example.com/x.png">' +
    '<p><a href="javascript:alert(1)">bad</a> <a href="https://example.com/menu">menu</a></p>';
  await editText();
  await page.keyboard.press("ControlOrMeta+a");
  // A paste event with the clipboard's HTML, as the browser sends for Ctrl+V.
  await editor().evaluate((element, html) => {
    const data = new DataTransfer();
    data.setData("text/html", html);
    data.setData("text/plain", "plain");
    element.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
    );
  }, pasted);

  await expect(editor()).toContainText("Opening hours");
  const html = await editor().innerHTML();
  expect(html).toContain("<strong>Monday</strong>");
  expect(html).toContain("<em>Friday</em>");
  expect(html).toContain('<a href="https://example.com/menu">menu</a>');
  expect(html).not.toMatch(/<h1|<u>|<table|<img|<span|style=|class="Mso|javascript:|font/);
});
