import { type ElectronApplication, expect, type Locator, type Page, test } from "@playwright/test";
import {
  ACTION_BAR_ACTION,
  ACTION_BAR_LABEL,
  COMPONENT,
  COMPONENT_ATTRIBUTE,
  OVERLAY,
} from "@webforge/engine/puck-dom";
import { OPEN_WAIT } from "./budget.js";
import { clickOnCanvas, editOnCanvas, stillBox } from "./canvas-click.js";
import { drag } from "./drag.js";
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

/**
 * How long a poll waits for the Table to be laid out, or outlined, as it should be (#1209). The
 * canvas compiles the styles a change needs a moment after it, and the first time on a worker, or
 * on a busy runner, that took longer than a poll's own 5 s: twice in 80 runs here, and in CI on
 * Windows and Linux. The polls still wait for the layout itself, only no longer give up at 5 s.
 */
const LAYOUT_WAIT = { timeout: OPEN_WAIT };

/** What {@link boxOf} throws for something not drawn: in a poll, not yet drawn (#1147). */
class NotShown extends Error {}

/** The box `locator` is drawn in, which must be shown. */
async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (box === null) throw new NotShown("not shown");
  return box;
}

/**
 * `check` for `expect.poll`, false while something it measures isn't drawn yet. A poll fails at
 * once on a throw: Puck's outline, drawn after a selection, wasn't there yet under load (#1147).
 */
const whenShown =
  (check: () => Promise<boolean>): (() => Promise<boolean>) =>
  async () => {
    try {
      return await check();
    } catch (error) {
      if (error instanceof NotShown) return false;
      throw error;
    }
  };

/** The first two rows' first two cells, as boxes: `a1` and `a2` in the first row, then `b1`, `b2`. */
async function cellBoxes() {
  const rows = canvas().locator("tr.site-table-row");
  const cell = (row: number, column: number) => boxOf(rows.nth(row).locator("td").nth(column));
  const [a1, a2, b1, b2] = await Promise.all([cell(0, 0), cell(0, 1), cell(1, 0), cell(1, 1)]);
  return { a1, a2, b1, b2 };
}

/**
 * Waits for the Table's styles, which the canvas compiles a moment after the change that placed
 * it: until then its rows stack all the same, only shorter, without their cells' padding. A point
 * picked on a row then was over the Table's headings once they came, so the Table stayed hovered
 * and its outline was taken for the row's (#1350). Until the first cell has its padding (`py-2`),
 * more than the 1 px a browser gives a cell of its own.
 */
async function waitForStyles() {
  const cell = canvas().locator("tr.site-table-row").first().locator("td").first();
  await expect
    .poll(
      () => cell.evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingTop)),
      LAYOUT_WAIT,
    )
    .toBeGreaterThan(1);
}

/** Places a Table from the Add panel, with its three starter rows, laid out with its styles. */
async function placeTable() {
  await left().getByRole("tab", { name: "Elements" }).click();
  await left().getByRole("button", { name: "Table", exact: true }).click();
  await expect(canvas().locator("tr.site-table-row")).toHaveCount(3);
  await waitForStyles();
  await expect
    .poll(
      whenShown(async () => {
        const { a1, b1 } = await cellBoxes();
        return b1.y >= a1.y + a1.height - 1;
      }),
      LAYOUT_WAIT,
    )
    .toBe(true);
}

/**
 * Row `n`'s (from 0) element on the canvas, and its wrapper, which the canvas draws as the row: the
 * `<tr>` itself has no box there, its cells laid out in the wrapper.
 */
const row = (n: number) => canvas().locator("tr.site-table-row").nth(n);
const wrapperOf = (n: number) =>
  canvas().locator(`.site-table > table > tbody > ${COMPONENT}`).nth(n);

/**
 * A point on row `n`'s left edge, in its first cell's padding: not on text, which edits. Once the
 * row keeps still, so the point is still on it when the pointer gets there (#1147).
 */
async function edgeOf(n: number) {
  const box = await stillBox(wrapperOf(n));
  return { x: box.x + 4, y: box.y + box.height / 2 };
}

/**
 * Selects row `n` by a click on its edge, as a person does, until the Edit panel shows a Table row,
 * and gives the point clicked. A click that selected nothing, or the Table, on CI's Linux runner
 * (#1272) is tried again, from the row's box as it is then; one that keeps missing says what the
 * Edit panel shows instead.
 */
async function selectRow(n: number) {
  const heading = right().getByRole("heading", { name: "Table row" });
  let edge = await edgeOf(n);
  await expect(async () => {
    edge = await edgeOf(n);
    await page.mouse.click(edge.x, edge.y);
    // What the panel shows now, without waiting for a heading there may not be.
    const shown = (await right().getByRole("heading").allTextContents()).join(", ") || "nothing";
    await expect(heading, `the Edit panel shows ${shown}`).toBeVisible({ timeout: 5_000 });
  }).toPass(LAYOUT_WAIT);
  return edge;
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
  await expect(canvas().locator(".site-table > table")).toHaveCount(1);
  await expect(canvas().locator("tr.site-table-row")).toHaveCount(3);
  await expect(canvas().locator("th")).toHaveText(["Item", "Price"]);
  await waitForStyles();

  // In columns: a row's cells side by side, under the headings, the second row under the first.
  await expect
    .poll(
      whenShown(async () => {
        const { a1, a2, b1, b2 } = await cellBoxes();
        const second = await boxOf(canvas().locator("th").nth(1));
        return (
          Math.abs(a2.y - a1.y) < 1 &&
          a2.x >= a1.x + a1.width - 1 &&
          Math.abs(b1.x - a1.x) < 1 &&
          Math.abs(b2.x - second.x) < 1 &&
          b1.y >= a1.y + a1.height - 1
        );
      }),
      LAYOUT_WAIT,
    )
    .toBe(true);

  // A row's wrapper is drawn as the row: around its cells, from the first to the last. Polled, as
  // the canvas's fonts can still re-wrap a cell.
  await expect
    .poll(
      whenShown(async () => {
        const [{ a1, a2 }, wrapperBox] = await Promise.all([cellBoxes(), boxOf(wrapperOf(0))]);
        return (
          Math.abs(wrapperBox.x - a1.x) < 1 &&
          Math.abs(wrapperBox.x + wrapperBox.width - (a2.x + a2.width)) < 1 &&
          Math.abs(wrapperBox.height - a1.height) < 1
        );
      }),
      LAYOUT_WAIT,
    )
    .toBe(true);

  // On its edge, in its first cell's padding, as a person selects it: not on its text, where a
  // pointer that has made the text editable starts an edit instead (#1209).
  await selectRow(0);
  await expect(right().getByRole("textbox", { name: "Column 2" })).toBeVisible();
  await expect(right().getByRole("textbox", { name: "Column 3" })).toHaveCount(0);

  // On Mobile, each row stacks its cells.
  await page
    .getByRole("toolbar", { name: "Canvas" })
    .getByRole("radio", { name: "Mobile" })
    .click();
  await expect
    .poll(
      whenShown(async () => {
        const { a1, a2, b1 } = await cellBoxes();
        return a2.y >= a1.y + a1.height - 1 && b1.y >= a2.y + a2.height - 1;
      }),
      LAYOUT_WAIT,
    )
    .toBe(true);
});

test("outlines a row, names its size, opens its menu where it is, edits a cell and moves the row", async () => {
  await placeTable();

  // Selected, the row's own outline fits it, and no other element's is drawn: the pointer is on
  // the row. Puck draws an outline for each hovered element as well as the selected one, so the
  // row's is found by its id, not taken as the first (#1350). Measured in one go in the canvas,
  // and polled for "fits" or what was drawn instead: whose each outline is, hovered or selected,
  // and where.
  const start = await selectRow(0);
  await expect
    .poll(
      () =>
        wrapperOf(0).evaluate(
          (wrapper, { idAttribute, outlineSelector }) => {
            const id = wrapper.getAttribute(idAttribute);
            const shown = (box: DOMRect) =>
              `${Math.round(box.width)} × ${Math.round(box.height)} at ${Math.round(box.x)}, ${Math.round(box.y)}`;
            const drawn = [...wrapper.ownerDocument.querySelectorAll(outlineSelector)].filter(
              (outline) => outline.getAttribute("data-state") !== "none",
            );
            const own = drawn.find((outline) => outline.getAttribute("data-wf-id") === id);
            const row = wrapper.getBoundingClientRect();
            const box = own?.getBoundingClientRect();
            const fits =
              drawn.length === 1 &&
              own?.getAttribute("data-state") === "selected" &&
              box !== undefined &&
              Math.abs(row.x - box.x) < 2 &&
              Math.abs(row.y - box.y) < 2 &&
              Math.abs(row.width - box.width) < 2 &&
              Math.abs(row.height - box.height) < 2;
            if (fits) return "fits";
            const outlines = drawn.map((outline) => {
              const whose = outline.getAttribute("data-wf-id") === id ? "the row's" : "another's";
              const state = outline.getAttribute("data-state");
              return `${whose} (${state}) ${shown(outline.getBoundingClientRect())}`;
            });
            return `row ${shown(row)}; outlines: ${outlines.join("; ") || "none"}`;
          },
          { idAttribute: COMPONENT_ATTRIBUTE, outlineSelector: `${OVERLAY} .wf-outline` },
        ),
      LAYOUT_WAIT,
    )
    .toBe("fits");

  // A cell is edited where it is: the third row's first. Before any menu opens, which can take
  // the focus back as it closes.
  const third = row(2).locator("td").first().locator("[contenteditable]");
  await editOnCanvas(third);
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("Third");
  await expect(row(2).locator("td").first()).toHaveText("Third");
  // The first row selected again, the text no longer edited.
  await page.mouse.click(start.x, start.y);
  await expect(third).not.toBeFocused();

  // Hovered with spacing on hover, its chip gives the row's own size.
  await page.getByRole("toolbar", { name: "Canvas" }).getByRole("button", { name: "View" }).click();
  const spacing = page.getByRole("menuitemcheckbox", { name: "Show Spacing on Hover" });
  await spacing.click();
  await page.keyboard.press("Escape");
  await expect(spacing).toBeHidden();
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
  // Gone before the canvas is clicked again: it closes with an animation.
  await expect(menu).toBeHidden();

  // Moved up twice with its bar, the row comes first.
  const end = await edgeOf(2);
  await page.mouse.click(end.x, end.y);
  await expect(right().getByRole("heading", { name: "Table row" })).toBeVisible(LAYOUT_WAIT);
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

test("keeps a Table with no rows open on the canvas, and lays a row added again out under its headings", async () => {
  await placeTable();
  await clickOnCanvas(canvas().locator("th").first());
  await expect(right().getByRole("heading", { name: "Table", exact: true })).toBeVisible(
    LAYOUT_WAIT,
  );
  const list = right().getByRole("group", { name: "Rows" });
  await expect(list.getByRole("listitem")).toHaveCount(3);

  for (let rows = 3; rows > 0; rows -= 1) {
    await list.getByRole("button", { name: "Delete Table row" }).first().click();
    await expect(canvas().locator("tr.site-table-row")).toHaveCount(rows - 1);
  }

  // The body, a slot with nothing in it, keeps the room Puck gives one (128px at the canvas's own
  // scale, which zooms out to fit a small window), across the table.
  const body = canvas().locator(".site-table > table > tbody");
  await expect
    .poll(async () => (await ownBox(body)).height, LAYOUT_WAIT)
    .toBeGreaterThanOrEqual(100);
  const [bodyBox, tableBox] = await Promise.all([
    ownBox(body),
    ownBox(canvas().locator(".site-table > table")),
  ]);
  expect(Math.abs(bodyBox.width - tableBox.width)).toBeLessThanOrEqual(1);

  await list.getByRole("button", { name: "Add Table row" }).click();
  await expect(canvas().locator("tr.site-table-row")).toHaveCount(1);
  // A row again, its cells under the headings, and the room gone.
  await expect
    .poll(
      whenShown(async () => {
        const cells = canvas().locator("tr.site-table-row td");
        const [first, second, heading] = await Promise.all([
          boxOf(cells.nth(0)),
          boxOf(cells.nth(1)),
          boxOf(canvas().locator("th").nth(1)),
        ]);
        const room = await boxOf(body);
        return (
          Math.abs(second.x - heading.x) < 1 &&
          Math.abs(second.y - first.y) < 1 &&
          Math.abs(room.height - first.height) < 1
        );
      }),
      LAYOUT_WAIT,
    )
    .toBe(true);
});

test("moves a row dragged over another, as one undoable step (#1144)", async () => {
  await placeTable();
  // Its cells told apart, to see the order change.
  for (const [n, text] of ["One", "Two", "Three"].entries()) {
    const cell = row(n).locator("td").first().locator("[contenteditable]");
    await editOnCanvas(cell);
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type(text);
  }
  await page.keyboard.press("Escape");
  const firsts = () => canvas().locator("tr.site-table-row > td:first-child");
  await expect(firsts()).toHaveText(["One", "Two", "Three"]);
  await left().getByRole("tab", { name: "Undo History" }).click();
  const steps = page.locator(".undo-history__step");

  // The third row, pressed on its edge (its first cell's padding, not its text, which edits),
  // dragged above the first: the drop preview shows there before it is let go.
  const third = await stillBox(wrapperOf(2));
  const first = await stillBox(wrapperOf(0));
  await drag(
    page,
    wrapperOf(2),
    { x: first.x + first.width / 2, y: first.y + first.height * 0.25 },
    4 / third.width,
  );

  await expect(firsts()).toHaveText(["Three", "One", "Two"]);
  await expect(canvas().locator(".site-table > table")).toHaveCount(1);
  await expect(steps.first()).toHaveText("Moved Table row");

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(firsts()).toHaveText(["One", "Two", "Three"]);
});
