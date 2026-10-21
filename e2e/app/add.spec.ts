import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp } from "./launch.js";

// Add panel (1.13, F-ED-1): sections and elements added by click, each one "Added …" step; never
// the Header, Footer or an FAQ's questions; the canvas's + opens it at its place; hidden in Content
// mode.

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
const left = () => page.getByRole("region", { name: "Left panels" });
const item = (name: string) => left().getByRole("button", { name, exact: true });
const steps = () => page.locator(".undo-history__step");

test("adds sections and elements by click, never the Header, Footer or a question", async () => {
  await expect(left().getByRole("tab", { name: "Add" })).toHaveAttribute("aria-selected", "true");
  await expect(item("Hero")).toBeVisible();
  await expect(item("Header")).toHaveCount(0);
  await expect(item("Footer")).toHaveCount(0);

  // Nothing selected: the Hero goes at the end of the page, and is selected.
  await item("Hero").click();
  await expect(canvas().locator(".site-hero")).toHaveCount(1);
  await left().getByRole("tab", { name: "Elements" }).click();
  await expect(item("Question")).toHaveCount(0);
  // The Hero takes no elements: the Text goes into the Section before it.
  await item("Text").click();
  await expect(canvas().locator(".site-section [contenteditable]")).toHaveCount(3);

  await left().getByRole("tab", { name: "Undo History" }).click();
  await expect(steps()).toHaveText(["Added Text", "Added Hero", "Opened page"]);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(canvas().locator(".site-section [contenteditable]")).toHaveCount(2);
});

test("the canvas's + opens Add at its place, even with the left panels hidden", async () => {
  await page.keyboard.press("ControlOrMeta+Alt+b");
  await expect(left()).toBeHidden();
  const section = canvas().locator(".site-section");
  const box = await section.boundingBox();
  if (box === null) throw new Error("Section not visible");
  // The Section's bottom padding selects the Section itself.
  await section.click({ force: true, position: { x: 10, y: box.height - 4 } });

  await canvas().getByTitle("Add a section here").click();
  await expect(left().getByRole("status")).toHaveText(/Choose a section to add after Section\./);
  await item("FAQ").click();

  await expect(left()).toBeVisible();
  await expect(canvas().locator(".site-faq")).toHaveCount(1);
  await expect(left().getByRole("status")).toHaveCount(0);
});

test("is hidden in Content mode", async () => {
  await page.getByRole("radio", { name: "Content", exact: true }).click();

  await expect(left().getByRole("tab", { name: "Add" })).toHaveCount(0);
  await page.getByRole("radio", { name: "Design", exact: true }).click();
  await expect(left().getByRole("tab", { name: "Add" })).toBeVisible();
});
