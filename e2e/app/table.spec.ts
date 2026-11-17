import { type ElectronApplication, expect, type Locator, type Page, test } from "@playwright/test";
import {
  ACTION_BAR_LABEL,
  COMPONENT,
  DRAGGING,
  DROP_PREVIEW,
  OVERLAY,
} from "@webforge/engine/puck-dom";
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

/** Row `n`'s (from 0) element on the canvas, and its wrapper. */
const row = (n: number) => canvas().locator("tr.site-table-row").nth(n);
const wrapperOf = (n: number) =>
  canvas()
    .locator(COMPONENT, { has: row(n) })
    .last();

/** A point on row `n`'s left edge, in its first cell's padding: not on text, which edits. */
async function edgeOf(n: number) {
  const box = await boxOf(row(n));
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

  // A row's wrapper has the row's box, which Puck's outline fits.
  const [rowBox, wrapperBox] = await Promise.all([boxOf(row(0)), boxOf(wrapperOf(0))]);
  expect(Math.abs(rowBox.height - wrapperBox.height)).toBeLessThan(1);
  expect(Math.abs(rowBox.width - wrapperBox.width)).toBeLessThan(1);

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

test("outlines a row, names its size, opens its menu where it is, edits a cell and drags the row", async () => {
  await placeTable();

  // Selected, Puck's outline fits the row.
  const start = await edgeOf(0);
  await page.mouse.click(start.x, start.y);
  await expect(right().getByRole("heading", { name: "Table row" })).toBeVisible();
  const overlay = canvas().locator(OVERLAY).first();
  await expect
    .poll(async () => {
      const [rowBox, outline] = await Promise.all([boxOf(row(0)), boxOf(overlay)]);
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
  const size = await ownBox(row(1));
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

  // Dragged by its edge above the first row, Puck's placeholder shows between the rows, and the
  // row lands first.
  const from = await edgeOf(2);
  const firstBox = await boxOf(row(0));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y + 10, { steps: 5 });
  const target = { x: firstBox.x + firstBox.width / 2, y: firstBox.y + firstBox.height * 0.25 };
  const preview = canvas().locator(DROP_PREVIEW).first();
  await expect
    .poll(
      async () => {
        await page.mouse.move(target.x, target.y - 6, { steps: 2 });
        await page.mouse.move(target.x, target.y, { steps: 4 });
        if ((await canvas().locator(DROP_PREVIEW).count()) === 0) return false;
        const at = await boxOf(preview);
        const table = await boxOf(canvas().locator("table.site-table"));
        // Within the table, across it, and above the second row: before or around the first.
        return (
          at.x >= table.x - 2 &&
          at.x + at.width <= table.x + table.width + 2 &&
          at.y < firstBox.y + firstBox.height
        );
      },
      { timeout: 10_000 },
    )
    .toBe(true);
  await page.mouse.up();
  await expect(canvas().locator(DRAGGING)).toHaveCount(0);
  await expect(row(0).locator("td").first()).toHaveText("Third");
  await expect(canvas().locator("tr.site-table-row")).toHaveCount(3);
  // Each wrapper still holds one row, laid out as one.
  const [rowBox, wrapperBox] = await Promise.all([boxOf(row(0)), boxOf(wrapperOf(0))]);
  expect(Math.abs(rowBox.height - wrapperBox.height)).toBeLessThan(1);
});
