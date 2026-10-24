import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, waitForCanvas } from "./launch.js";

// Columns (2.9): placed from the Add panel with two columns of their own, side by side on Desktop
// and stacked on Mobile at first, on the canvas as in the export.

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

/** The tops and lefts of the canvas's columns, in order. */
async function columnBoxes() {
  const columns = canvas().locator(".site-column");
  await expect(columns).toHaveCount(2);
  const boxes = await Promise.all([0, 1].map((index) => columns.nth(index).boundingBox()));
  return boxes.map((box) => {
    if (box === null) throw new Error("A column isn't shown");
    return box;
  });
}

test("places two columns side by side on Desktop, stacked on Mobile", async () => {
  await left().getByRole("tab", { name: "Elements" }).click();
  await left().getByRole("button", { name: "Columns", exact: true }).click();
  await expect(canvas().locator(".site-columns")).toHaveCount(1);
  await expect(canvas().locator(".site-column")).toHaveText([
    "Write something for this column.",
    "Write something for this column.",
  ]);

  // Side by side once the canvas has its styles, which it compiles a moment after the change.
  await expect
    .poll(async () => {
      const [first, second] = await columnBoxes();
      return (
        Math.abs((second?.y ?? 0) - (first?.y ?? -1)) < 1 &&
        (second?.x ?? 0) >= (first?.x ?? 0) + (first?.width ?? 0) - 1
      );
    })
    .toBe(true);

  await page
    .getByRole("toolbar", { name: "Canvas" })
    .getByRole("radio", { name: "Mobile" })
    .click();
  await expect
    .poll(async () => {
      const [top, bottom] = await columnBoxes();
      return (bottom?.y ?? 0) >= (top?.y ?? 0) + (top?.height ?? 0) - 1;
    })
    .toBe(true);

  // One step, undone in one go.
  await page.keyboard.press("ControlOrMeta+z");
  await expect(canvas().locator(".site-columns")).toHaveCount(0);
});

test("lays columns out from the toolbar: add one, widen the first, outlines on the canvas only (2.17)", async () => {
  await left().getByRole("tab", { name: "Elements" }).click();
  await left().getByRole("button", { name: "Columns", exact: true }).click();
  const columns = canvas().locator(".site-column");
  await expect(columns).toHaveCount(2);
  // Placed, the Columns is selected, and its toolbar is in the row under the canvas toolbar.
  const toolbar = page.getByRole("toolbar", { name: "Selected element" });
  const widths = toolbar.getByRole("radiogroup", { name: "Column widths on Desktop" });
  await expect(widths).toBeVisible();

  // Outlined as a preview at first, dashed, and marked so the export can't have it.
  await expect(columns.first()).toHaveAttribute("data-webforge-preview", "column-outline");
  await expect
    .poll(() => columns.first().evaluate((column) => getComputedStyle(column).outlineStyle))
    .toBe("dashed");

  await toolbar.getByRole("button", { name: "Add column" }).click();
  await expect(columns).toHaveCount(3);
  // The new column is selected: its Columns' toolbar stays.
  await widths.getByRole("radio", { name: "First one wider" }).click();
  await expect
    .poll(async () => {
      const [first, second] = await Promise.all(
        [0, 1].map(async (index) => (await columns.nth(index).boundingBox())?.width ?? 0),
      );
      return (first ?? 0) > (second ?? 0) * 1.8;
    })
    .toBe(true);

  await toolbar.getByRole("button", { name: "Show column outlines" }).click();
  await expect(columns.first()).not.toHaveAttribute("data-webforge-preview");
  // Each change one step; the outlines none.
  await left().getByRole("tab", { name: "Undo History" }).click();
  await expect(page.locator(".undo-history__step")).toHaveText([
    "Changed Columns column widths",
    "Added Column",
    "Added Columns",
    "Opened page",
  ]);
});
