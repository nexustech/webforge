import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { ACTION_BAR_ACTION, ACTION_BAR_LABEL, SELECTED_COMPONENT } from "@webforge/engine/puck-dom";
import { launchDesktopApp, waitForCanvas } from "./launch.js";

// Undo History panel and Undo toasts (1.11, D3, D4): deleting shows "Deleted … · Undo"; jumping to
// a step brings back the page and the selection of that moment (U3).

const STARTER_HEADING = "Welcome to our business";
const STARTER_TEXT = "Tell visitors what you do and why they will love it.";

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  // Undo History is the left column's second tab, after Add.
  await page
    .getByRole("region", { name: "Left panels" })
    .getByRole("tab", { name: "Undo History" })
    .click();
  await expect(canvas().locator("h1")).toHaveText(STARTER_HEADING);
  // The site CSS changes the layout when it arrives; clicks need the final positions.
  await waitForCanvas(page);
});

test.afterEach(async () => {
  await app.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const history = () => page.getByRole("list", { name: "Undo History" });
const step = (label: string) => history().getByRole("button", { name: label });
/** The label of Puck's action bar, which names the selected element. */
// The selected element's name, in its bar: a hovered element's chip is a label too (SP-1).
const selected = () => canvas().locator(`${SELECTED_COMPONENT} ${ACTION_BAR_LABEL}`);

/** Selects the starter heading and deletes it with Puck's action bar. */
async function deleteHeading(): Promise<void> {
  await canvas().locator("h1").click();
  await expect(selected()).toHaveText("Heading");
  await canvas().locator(`${ACTION_BAR_ACTION}[title="Delete"]`).click();
  await expect(canvas().locator("h1")).toHaveCount(0);
}

test.describe("Undo History and Undo toasts", () => {
  test("a delete shows 'Deleted Heading · Undo', and Undo brings the heading back selected", async () => {
    await deleteHeading();

    const toast = page.locator("[data-sonner-toast]").filter({ hasText: "Deleted Heading" });
    await expect(toast).toBeVisible();
    await expect(step("Deleted Heading")).toHaveAttribute("aria-current", "step");

    await toast.getByRole("button", { name: "Undo" }).click();

    await expect(canvas().locator("h1")).toHaveText(STARTER_HEADING);
    await expect(step("Opened page")).toHaveAttribute("aria-current", "step");
    // The step stays, greyed, until a new edit discards it; the heading is selected again.
    await expect(step("Deleted Heading")).toHaveAttribute("data-state", "undone");
    await expect(selected()).toHaveText("Heading");
  });

  test("jumping to a step restores that moment's content and selection", async () => {
    await deleteHeading();
    // Select something else, so the jump has a selection to bring back.
    await canvas().getByText(STARTER_TEXT).click();
    await expect(selected()).toHaveText("Text");

    await step("Opened page").click();

    await expect(canvas().locator("h1")).toHaveText(STARTER_HEADING);
    await expect(selected()).toHaveText("Heading");

    await step("Deleted Heading").click();
    await expect(canvas().locator("h1")).toHaveCount(0);
    await expect(step("Deleted Heading")).toHaveAttribute("aria-current", "step");
  });

  test("the arrow beside Undo undoes back to a recent step, which Redo brings back (UX-16)", async () => {
    await deleteHeading();
    await canvas().getByText(STARTER_TEXT).click();
    await expect(selected()).toHaveText("Text");
    await canvas().locator(`${ACTION_BAR_ACTION}[title="Delete"]`).click();
    await expect(canvas().getByText(STARTER_TEXT)).toHaveCount(0);

    await page.getByRole("button", { name: "Undo several steps" }).click();
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem")).toHaveText([
      "Deleted Text, Undoes this step",
      "Deleted Heading, Undoes 2 steps",
    ]);
    await menu.getByRole("menuitem", { name: /^Deleted Heading/ }).click();

    await expect(canvas().locator("h1")).toHaveText(STARTER_HEADING);
    await expect(canvas().getByText(STARTER_TEXT)).toHaveCount(1);
    await expect(step("Opened page")).toHaveAttribute("aria-current", "step");
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect(canvas().locator("h1")).toHaveCount(0);
    await expect(step("Deleted Heading")).toHaveAttribute("aria-current", "step");
  });
});
