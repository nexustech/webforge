import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { placeCaret, selectText } from "./caret.js";
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
  // Undo History is the left column's second tab, after Add.
  await page
    .getByRole("region", { name: "Left panels" })
    .getByRole("tab", { name: "Undo History" })
    .click();
});

test.afterEach(async () => {
  await app.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const editor = () => canvas().locator(".site-text .ProseMirror");
const steps = () => page.locator(".undo-history__step");

/**
 * Leaves the text, ending its editing session: a click on the Section's bottom padding, clear of the
 * format toolbar, which sits over the text and the heading above it.
 */
async function leaveText(): Promise<void> {
  const section = canvas().locator(".site-section");
  const box = await section.boundingBox();
  if (box === null) throw new Error("Section not visible");
  await section.click({ force: true, position: { x: 10, y: box.height - 4 } });
}

/** Puts the caret in the starter text, in the real Tiptap editor. */
async function editText(): Promise<void> {
  await canvas().getByText(STARTER_TEXT).click();
  await editor().click();
  await expect(editor()).toBeFocused();
}

test("keeps every keystroke typed straight after the first click into rich text (ADR 0004)", async () => {
  // A smoke test: no waiting for the editor. The engine test (rich-text-eager.test.tsx) checks
  // that Puck's fallback, which lost what was typed while the editor loaded, never mounts.
  await canvas().getByText(STARTER_TEXT).click();
  // End, not placeCaret, which would wait for the editor. On macOS End leaves the caret where the
  // click put it, which is past the text's end.
  await page.keyboard.press("End");
  await page.keyboard.type(" Open daily.", { delay: 5 });

  await expect(editor()).toHaveText(`${STARTER_TEXT} Open daily.`);
  await leaveText();
  await expect(steps().first()).toHaveText("Edited Text text");
});

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
  await leaveText();
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

test("links selected text through the link dialog, as part of the text's one step", async () => {
  await editText();
  await selectText(editor());
  const toolbar = canvas().locator("[data-puck-rte-menu]");
  await toolbar.getByRole("button", { name: "Link…" }).click();

  const dialog = page.getByRole("dialog", { name: "Link" });
  await dialog.getByRole("radio", { name: "Web address" }).click();
  await dialog.getByRole("textbox", { name: "Web address" }).fill("example.com");
  await dialog.getByRole("checkbox", { name: "Open in a new tab" }).check();
  await dialog.getByRole("button", { name: "Save Link" }).click();

  const link = editor().locator("a");
  await expect(link).toHaveText(STARTER_TEXT);
  await expect(link).toHaveAttribute("href", "https://example.com");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(dialog).toHaveCount(0);

  // Linked to a section of this page: the section gets its anchor in the same step.
  await toolbar.getByRole("button", { name: "Link…" }).click();
  await dialog.getByRole("radio", { name: "Page", exact: true }).click();
  await dialog.getByRole("combobox", { name: "Page" }).selectOption({ label: "My site" });
  await dialog.getByRole("combobox", { name: "Section" }).selectOption({ index: 1 });
  await dialog.getByRole("button", { name: "Save Link" }).click();
  await expect(link).toHaveAttribute("href", /^webforge:page\/[^#]+#[a-z]/);
  const anchor = (await link.getAttribute("href"))?.split("#")[1] ?? "";
  await expect(canvas().locator(`#${anchor}`)).toHaveCount(1);

  // The dialog fades out over the canvas: a click before it has gone lands on it.
  await expect(dialog).toHaveCount(0);
  await leaveText();
  await expect(steps()).toHaveText(["Edited Text text", "Opened page"]);
  await page.locator(".editor__canvas").focus();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(editor().locator("a")).toHaveCount(0);
  await expect(canvas().locator(`#${anchor}`)).toHaveCount(0);
});

test("removes a link from the toolbar", async () => {
  await editText();
  await selectText(editor());
  const toolbar = canvas().locator("[data-puck-rte-menu]");
  await toolbar.getByRole("button", { name: "Link…" }).click();
  const dialog = page.getByRole("dialog", { name: "Link" });
  await dialog.getByRole("radio", { name: "Email" }).click();
  await dialog.getByRole("textbox", { name: "Email address" }).fill("rosa@example.com");
  await dialog.getByRole("button", { name: "Save Link" }).click();
  await expect(editor().locator("a")).toHaveAttribute("href", "mailto:rosa@example.com");

  // Back in the text, the caret in the link, as a user would put it there.
  await expect(dialog).toHaveCount(0);
  await editor().locator("a").click();
  await toolbar.getByRole("button", { name: "Remove link" }).click();
  await expect(editor().locator("a")).toHaveCount(0);
});

test("links text and removes links in Content mode, which keeps text and links editable (M3)", async () => {
  await page.getByRole("radio", { name: "Content", exact: true }).click();
  // In Content mode the first click puts the caret in the text.
  await canvas().getByText(STARTER_TEXT).click();
  await expect(editor()).toBeFocused();
  await selectText(editor());
  const toolbar = canvas().locator("[data-puck-rte-menu]");
  const dialog = page.getByRole("dialog", { name: "Link" });

  // To a section of this page: the anchor it gives the section is allowed in Content mode too.
  await toolbar.getByRole("button", { name: "Link…" }).click();
  await dialog.getByRole("combobox", { name: "Section" }).selectOption({ index: 1 });
  await dialog.getByRole("button", { name: "Save Link" }).click();
  await expect(dialog).toHaveCount(0);
  const link = editor().locator("a");
  await expect(link).toHaveAttribute("href", /^webforge:page\/[^#]+#[a-z]/);
  const anchor = (await link.getAttribute("href"))?.split("#")[1] ?? "";
  await expect(canvas().locator(`#${anchor}`)).toHaveCount(1);

  // The caret into the link, from the keyboard: in Content mode dnd-kit marks each element
  // `aria-disabled`, so a test's click inside one waits for it to be enabled (1.26 removes that).
  // The dialog hands the focus back and Tiptap restores the selection a frame later; keys pressed
  // before that can lose the caret's move. Move it again until Remove link, which shows while the
  // caret is in the link, can be clicked.
  await expect(editor()).toBeFocused();
  await expect(async () => {
    await placeCaret(editor(), "start");
    await page.keyboard.press("ArrowRight");
    await toolbar.getByRole("button", { name: "Remove link" }).click({ timeout: 1_000 });
  }).toPass();
  await expect(editor().locator("a")).toHaveCount(0);
  await leaveText();
  await expect(steps()).toHaveText(["Edited Text text", "Opened page"]);
});
