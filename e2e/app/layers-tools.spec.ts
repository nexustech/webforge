import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp } from "./launch.js";

// Layers tools and the element menu (1.35, F-ED-26): one right-click menu on the canvas and in
// Layers; while a layer is dragged, the rows it can't go to are marked; a filter and Expand/Collapse
// all.

const STARTER_HEADING = "Welcome to our business";

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  await expect(canvas().locator("h1")).toHaveText(STARTER_HEADING);
});

test.afterEach(async () => {
  await app.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const left = () => page.getByRole("region", { name: "Left panels" });
const tree = () => left().getByRole("tree", { name: "Layers" });
const row = (name: string) => tree().getByRole("treeitem", { name: new RegExp(`^${name}`) });
const menu = () => page.getByRole("menu", { name: "Element actions" });
/** The menu's items, with whether each is on. */
const menuItems = async () =>
  Promise.all(
    (await menu().getByRole("menuitem").all()).map(async (item) => [
      await item.innerText(),
      (await item.getAttribute("aria-disabled")) !== "true",
    ]),
  );

async function showLayers(): Promise<void> {
  await page.getByRole("menuitem", { name: "View" }).click();
  await page.getByRole("menuitem", { name: "Use Advanced Mode" }).click();
  await left().getByRole("tab", { name: "Layers" }).click();
  await expect(row("Section")).toBeVisible();
}

test("opens the same menu on the canvas and in Layers, acting on what was right-clicked", async () => {
  await showLayers();

  await canvas().locator("h1").click({ button: "right" });
  await expect(menu()).toBeVisible();
  const onCanvas = await menuItems();
  await page.keyboard.press("Escape");
  await expect(menu()).toHaveCount(0);
  // The right-clicked element was selected first, so the menu acted on it.
  await expect(row("Heading")).toHaveAttribute("aria-selected", "true");

  // From the keyboard in Layers: the same menu, and Esc gives the row its focus back.
  await row("Heading").focus();
  await page.keyboard.press("Shift+F10");
  await expect(menu()).toBeVisible();
  expect(await menuItems()).toEqual(onCanvas);
  await page.keyboard.press("Escape");
  await expect(row("Heading")).toBeFocused();

  await row("Heading").click({ button: "right" });
  await expect(menu()).toBeVisible();
  expect(await menuItems()).toEqual(onCanvas);
  expect(onCanvas.map(([label]) => String(label).split("\n")[0])).toEqual([
    "Rename",
    "Duplicate",
    "Save as shared section…",
    "Delete",
  ]);

  await menu()
    .getByRole("menuitem", { name: /Duplicate/ })
    .click();
  await expect(canvas().locator("h1")).toHaveCount(2);

  // Rename on the canvas asks for the name; Layers shows it.
  await canvas().locator(".site-text").click({ button: "right" });
  await menu().getByRole("menuitem", { name: "Rename" }).click();
  const dialog = page.getByRole("dialog", { name: "Rename Text" });
  await dialog.getByRole("textbox").fill("Intro");
  await dialog.getByRole("button", { name: "Rename" }).click();
  await expect(row("Intro")).toBeVisible();
});

test("marks the rows a dragged layer can't go to, before it is dropped", async () => {
  await showLayers();
  const heading = row("Heading");
  const section = row("Section");
  const from = await heading.boundingBox();
  const to = await section.boundingBox();
  if (from === null || to === null) throw new Error("rows not visible");

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });

  // The Section is outside the heading's own list: marked, and not a drop target.
  await expect(section).toHaveAttribute("data-drop", "not-allowed");
  await expect(row("Text")).not.toHaveAttribute("data-drop", "not-allowed");
  await page.mouse.up();

  await expect(section).not.toHaveAttribute("data-drop", "not-allowed");
  await expect(canvas().locator(".site-section h1")).toHaveCount(1);
});

test("filters Layers and collapses or expands the whole tree", async () => {
  await showLayers();

  await left().getByRole("button", { name: "Collapse all" }).click();
  await expect(row("Section")).toHaveAttribute("aria-expanded", "false");
  await expect(row("Heading")).toHaveCount(0);
  await left().getByRole("button", { name: "Expand all" }).click();
  await expect(row("Heading")).toBeVisible();

  await left().getByRole("searchbox", { name: "Filter layers" }).fill("text");
  await expect(tree().getByRole("treeitem")).toHaveCount(2);
  await expect(row("Heading")).toHaveCount(0);
  await left().getByRole("searchbox", { name: "Filter layers" }).press("Escape");
  await expect(row("Heading")).toBeVisible();
});

test("in Content mode, leaves the canvas's right-clicks alone and Layers' menu to Rename", async () => {
  await showLayers();
  await page.getByRole("radio", { name: "Content", exact: true }).click();

  await canvas().locator("h1").click({ button: "right" });
  await expect(menu()).toHaveCount(0);

  await row("Heading").click({ button: "right" });
  await expect(menu()).toBeVisible();
  expect((await menuItems()).map(([label, on]) => [String(label).split("\n")[0], on])).toEqual([
    ["Rename", true],
    ["Duplicate", false],
    ["Save as shared section…", false],
    ["Delete", false],
  ]);
});
