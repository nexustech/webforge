import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp } from "./launch.js";
import { chooseFromMenu } from "./menus.js";

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

/** Layers is always shown, under Add and Undo History (ADR 0011). */
async function showLayers(): Promise<void> {
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
    "Select similar",
    "Select parent",
    "Cut",
    "Copy",
    "Paste",
    "Paste as Linked Copy",
    "Copy Style",
    "Paste Style",
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

/**
 * Drags Layers row `from` onto `to` (the same row: within it), holding `keys` from the press, and
 * `added` from once the drag has started: Chromium starts no drag from a press with Shift held.
 */
async function dragRow(
  from: string,
  to: string,
  keys: readonly string[],
  added: readonly string[] = [],
): Promise<void> {
  const start = await row(from).first().boundingBox();
  const end = await row(to).first().boundingBox();
  if (start === null || end === null) throw new Error("rows not visible");
  for (const key of keys) await page.keyboard.down(key);
  await page.mouse.move(start.x + start.width / 2, start.y + start.height * 0.2);
  await page.mouse.down();
  // Far enough for a drag to start, even within the same row.
  await page.mouse.move(start.x + start.width / 2 + 20, start.y + start.height * 0.2, { steps: 4 });
  for (const key of added) await page.keyboard.down(key);
  await page.mouse.move(end.x + end.width / 2, end.y + end.height * 0.8, { steps: 8 });
  await page.mouse.up();
  for (const key of [...keys, ...added].reverse()) await page.keyboard.up(key);
}

test("Select similar selects every element of the kind on the page, from the menu (1.35)", async () => {
  await showLayers();
  await canvas().locator("h1").click({ button: "right" });
  await menu()
    .getByRole("menuitem", { name: /Duplicate/ })
    .click();
  await expect(canvas().locator("h1")).toHaveCount(2);
  await expect(tree().getByRole("treeitem", { selected: true })).toHaveCount(1);

  // The copy is selected; its quick actions sit over the first heading, so the copy is clicked.
  // While the canvas settles after Duplicate, a menu opened at once can close again (on Linux CI
  // it was gone before the click): open it again until Select similar takes the click.
  await expect(async () => {
    await page.keyboard.press("Escape");
    await canvas().locator("h1").last().click({ button: "right", timeout: 2_000 });
    await menu().getByRole("menuitem", { name: "Select similar" }).click({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });

  await expect(page.getByRole("status").filter({ hasText: "2 elements selected" })).toBeVisible();
  await expect(tree().getByRole("treeitem", { selected: true })).toHaveCount(2);
});

test("copies a layer dragged with Ctrl/Cmd, and places another linked copy with Shift too (1.35, UX-4)", async () => {
  await showLayers();

  await dragRow("Heading", "Text", ["ControlOrMeta"]);
  await expect(canvas().locator("h1")).toHaveCount(2);
  // One step: a single undo takes the copy away.
  await page.keyboard.press("ControlOrMeta+z");
  await expect(canvas().locator("h1")).toHaveCount(1);

  // A linked copy of a shared section, dragged onto itself with Shift too: another linked copy.
  await row("Section").first().click();
  await chooseFromMenu(app, page, "Edit", "Save as shared section…");
  const dialog = page.getByRole("dialog", { name: "Save as shared section" });
  await dialog.getByRole("textbox", { name: "Name" }).fill("Welcome");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(tree().getByRole("treeitem", { name: /Welcome/ })).toHaveCount(1);

  await dragRow(
    "Linked copy of 'Welcome'",
    "Linked copy of 'Welcome'",
    ["ControlOrMeta"],
    ["Shift"],
  );
  // Another linked copy of Welcome: Layers shows two, and the canvas two sections.
  await expect(tree().getByRole("treeitem", { name: /Welcome/ })).toHaveCount(2);
  await expect(canvas().locator(".site-section")).toHaveCount(2);
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

test("keeps what Layers shows, its collapsed layers and filter, when the mode switches (R9)", async () => {
  await showLayers();
  const mode = (name: "Design" | "Content") => page.getByRole("radio", { name, exact: true });
  const filter = () => left().getByRole("searchbox", { name: "Filter layers" });

  await left().getByRole("button", { name: "Collapse all" }).click();
  await expect(row("Section")).toHaveAttribute("aria-expanded", "false");
  await mode("Content").click();
  await expect(mode("Content")).toHaveAttribute("data-state", "on");
  await expect(row("Section")).toHaveAttribute("aria-expanded", "false");
  await expect(row("Heading")).toHaveCount(0);

  await filter().fill("text");
  await mode("Design").click();
  await expect(mode("Design")).toHaveAttribute("data-state", "on");
  await expect(filter()).toHaveValue("text");
  await expect(tree().getByRole("treeitem")).toHaveCount(2);
});

test("in Content mode, leaves the canvas's right-clicks alone and Layers' menu to Rename", async () => {
  await showLayers();
  await page.getByRole("radio", { name: "Content", exact: true }).click();
  // The canvas's right-click gets the browser's own menu (Cut, Copy, Paste): not shown, as a
  // native menu left open on macOS stops the app from closing (#287).
  await app.evaluate(({ Menu }) => {
    Menu.prototype.popup = () => undefined;
  });

  await canvas().locator("h1").click({ button: "right" });
  await expect(menu()).toHaveCount(0);

  await row("Heading").click({ button: "right" });
  await expect(menu()).toBeVisible();
  expect((await menuItems()).map(([label, on]) => [String(label).split("\n")[0], on])).toEqual([
    ["Rename", true],
    ["Duplicate", false],
    ["Save as shared section…", false],
    // Selecting changes no layout (M3).
    ["Select similar", true],
    ["Select parent", true],
    // Copying isn't a change to the layout: Content mode keeps it (M3).
    ["Cut", false],
    ["Copy", true],
    ["Paste", false],
    ["Paste as Linked Copy", false],
    ["Copy Style", false],
    ["Paste Style", false],
    ["Delete", false],
  ]);
});
