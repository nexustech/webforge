import { type ElectronApplication, expect, type Locator, type Page, test } from "@playwright/test";
import { ACTION_BAR_ACTION, ACTION_BAR_LABEL, COMPONENT, OVERLAY } from "@webforge/engine/puck-dom";
import { clickOnCanvas } from "./canvas-click.js";
import { launchDesktopApp, waitForCanvas } from "./launch.js";

// The Table (6.16c): placed from the Add panel, its rows laid out on the canvas as the export lays
// them out, though Puck wraps each in a div of its own; each row selected by a click, its cells
// following its Table's Columns.

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  await waitForCanvas(page);
});

test.afterEach(async () => {
  await app.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const left = () => page.getByRole("region", { name: "Left panels" });
const right = () => page.getByRole("region", { name: "Right panels" });

/** The box `locator` is drawn in, which must be shown. */
async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (box === null) throw new Error("not shown");
  return box;
}

/** The first two rows' first two cells, as boxes: `a1` and `a2` in the first row, then `b1`, `b2`. */
async function cellBoxes() {
  const rows = canvas().locator("tr.site-table-row");
  const cell = (row: number, column: number) => boxOf(rows.nth(row).locator("td").nth(column));
  const [a1, a2, b1, b2] = await Promise.all([cell(0, 0), cell(0, 1), cell(1, 0), cell(1, 1)]);
  return { a1, a2, b1, b2 };
}

/** Places a Table from the Add panel, with its three starter rows. */
async function placeTable() {
  await left().getByRole("tab", { name: "Elements" }).click();
  await left().getByRole("button", { name: "Table", exact: true }).click();
  await expect(canvas().locator("tr.site-table-row")).toHaveCount(3);
  // Laid out once the canvas has its styles, which it compiles a moment after the change.
  await expect
    .poll(async () => {
      const { a1, b1 } = await cellBoxes();
      return b1.y >= a1.y + a1.height - 1;
    })
    .toBe(true);
}

/**
 * Row `n`'s (from 0) element on the canvas, and its wrapper, which the canvas draws as the row: the
 * `<tr>` itself has no box there, its cells laid out in the wrapper.
 */
const row = (n: number) => canvas().locator("tr.site-table-row").nth(n);
const wrapperOf = (n: number) => canvas().locator(`table.site-table > tbody > ${COMPONENT}`).nth(n);

/** A point on row `n`'s left edge, in its first cell's padding: not on text, which edits. */
async function edgeOf(n: number) {
  const box = await boxOf(wrapperOf(n));
  return { x: box.x + 4, y: box.y + box.height / 2 };
}

/** The box of `locator`'s element in its own document, at the canvas's own scale. */
const ownBox = (locator: Locator) =>
  locator.evaluate((element) => {
    const { width, height } = element.getBoundingClientRect();
    return { width: Math.round(width), height: Math.round(height) };
  });

test("lays its rows out as the table's, selects a row and shows its Table's columns", async () => {
  await left().getByRole("tab", { name: "Elements" }).click();
  await left().getByRole("button", { name: "Table", exact: true }).click();
  await expect(canvas().locator("table.site-table")).toHaveCount(1);
  await expect(canvas().locator("tr.site-table-row")).toHaveCount(3);
  await expect(canvas().locator("th")).toHaveText(["Item", "Price"]);

  // In columns: a row's cells side by side, under the headings, the second row under the first.
  await expect
    .poll(async () => {
      const { a1, a2, b1, b2 } = await cellBoxes();
      const second = await boxOf(canvas().locator("th").nth(1));
      return (
        Math.abs(a2.y - a1.y) < 1 &&
        a2.x >= a1.x + a1.width - 1 &&
        Math.abs(b1.x - a1.x) < 1 &&
        Math.abs(b2.x - second.x) < 1 &&
        b1.y >= a1.y + a1.height - 1
      );
    })
    .toBe(true);

  // A row's wrapper is drawn as the row: around its cells, from the first to the last.
  const { a1, a2 } = await cellBoxes();
  const wrapperBox = await boxOf(wrapperOf(0));
  expect(Math.abs(wrapperBox.x - a1.x)).toBeLessThan(1);
  expect(Math.abs(wrapperBox.x + wrapperBox.width - (a2.x + a2.width))).toBeLessThan(1);
  expect(Math.abs(wrapperBox.height - a1.height)).toBeLessThan(1);

  await clickOnCanvas(row(0).locator("td").first());
  await expect(right().getByRole("heading", { name: "Table row" })).toBeVisible();
  await expect(right().getByRole("textbox", { name: "Column 2" })).toBeVisible();
  await expect(right().getByRole("textbox", { name: "Column 3" })).toHaveCount(0);

  // On Mobile, each row stacks its cells.
  await page
    .getByRole("toolbar", { name: "Canvas" })
    .getByRole("radio", { name: "Mobile" })
    .click();
  await expect
    .poll(async () => {
      const { a1, a2, b1 } = await cellBoxes();
      return a2.y >= a1.y + a1.height - 1 && b1.y >= a2.y + a2.height - 1;
    })
    .toBe(true);
});

test("outlines a row, names its size, opens its menu where it is, edits a cell and moves the row", async () => {
  await placeTable();

  // Selected, Puck's outline fits the row.
  const start = await edgeOf(0);
  await page.mouse.click(start.x, start.y);
  await expect(right().getByRole("heading", { name: "Table row" })).toBeVisible();
  const overlay = canvas().locator(OVERLAY).first();
  await expect
    .poll(async () => {
      const [rowBox, outline] = await Promise.all([boxOf(wrapperOf(0)), boxOf(overlay)]);
      return (
        Math.abs(rowBox.y - outline.y) < 2 &&
        Math.abs(rowBox.height - outline.height) < 2 &&
        Math.abs(rowBox.width - outline.width) < 2
      );
    })
    .toBe(true);

  // Hovered with spacing on hover, its chip gives the row's own size.
  await page.getByRole("toolbar", { name: "Canvas" }).getByRole("button", { name: "View" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Show Spacing on Hover" }).click();
  await page.keyboard.press("Escape");
  const second = await edgeOf(1);
  await page.mouse.move(second.x, second.y);
  const size = await ownBox(wrapperOf(1));
  await expect(canvas().locator(ACTION_BAR_LABEL, { hasText: /^Table row ·/ })).toHaveText(
    `Table row · ${size.width} × ${size.height}`,
  );

  // Right-clicked, its menu opens where the pointer is.
  await page.mouse.click(second.x, second.y, { button: "right" });
  const menu = page.getByRole("menu", { name: "Element actions" });
  await expect(menu).toBeVisible();
  const menuBox = await boxOf(menu);
  expect(Math.abs(menuBox.x - second.x)).toBeLessThan(24);
  expect(Math.abs(menuBox.y - second.y)).toBeLessThan(24);
  await page.keyboard.press("Escape");

  // A cell is edited where it is: the third row's first.
  const third = row(2).locator("td").first().locator("[contenteditable]");
  await clickOnCanvas(third);
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("Third");
  await expect(row(2).locator("td").first()).toHaveText("Third");

  // Moved up twice with its bar, the row comes first.
  const end = await edgeOf(2);
  await page.mouse.click(end.x, end.y);
  await expect(right().getByRole("heading", { name: "Table row" })).toBeVisible();
  const moveUp = canvas()
    .locator(ACTION_BAR_ACTION)
    .and(canvas().getByRole("button", { name: "Move up", exact: true }));
  await moveUp.click();
  await expect(row(1).locator("td").first()).toHaveText("Third");
  await moveUp.click();
  await expect(row(0).locator("td").first()).toHaveText("Third");
  await expect(canvas().locator("tr.site-table-row")).toHaveCount(3);
  // Its cells moved with it, still in columns.
  const { a1, b1 } = await cellBoxes();
  expect(Math.abs(b1.x - a1.x)).toBeLessThan(1);
});

test("leaves the page as it was when a row is dragged and dropped on another (#1144)", async () => {
  await placeTable();
  // Its cells told apart, to see any order change.
  for (const [n, text] of ["One", "Two", "Three"].entries()) {
    await clickOnCanvas(row(n).locator("td").first().locator("[contenteditable]"));
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type(text);
  }
  await page.keyboard.press("Escape");
  const firsts = () => canvas().locator("tr.site-table-row > td:first-child");
  await expect(firsts()).toHaveText(["One", "Two", "Three"]);
  await left().getByRole("tab", { name: "Undo History" }).click();
  const steps = page.locator(".undo-history__step");
  const before = await steps.count();

  // Pressed on the third row's edge, moved over the first and let go there.
  const from = await edgeOf(2);
  const to = await boxOf(wrapperOf(0));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y + 10, { steps: 5 });
  for (let y = from.y; y >= to.y + 4; y -= 6) {
    await page.mouse.move(from.x + 12, y, { steps: 2 });
  }
  await page.mouse.up();

  // Nothing moved, nothing went, and no step was made.
  await expect(firsts()).toHaveText(["One", "Two", "Three"]);
  await expect(canvas().locator("table.site-table")).toHaveCount(1);
  await expect(steps).toHaveCount(before);
});
