import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, waitForCanvas } from "./launch.js";

// Spacing handles on the canvas (1.32, F-ED-25): grips on the selected element's edges set its
// padding and margin, each drag one labelled undo step; Esc cancels a drag.

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  await page
    .getByRole("region", { name: "Left panels" })
    .getByRole("tab", { name: "Undo History" })
    .click();
  await waitForCanvas(page);
});

test.afterEach(async () => {
  await app.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const panel = () => page.getByRole("region", { name: "Right panels" });
/** Undo History's steps, newest first, down to "Opened page". */
const steps = () => page.locator(".undo-history__step");
const grip = (property: "padding" | "margin", side: "top" | "bottom") =>
  canvas().locator(`.wf-grip[data-property="${property}"][data-side="${side}"]`);

/** Selects the starter Section by clicking inside its bottom padding, clear of its grips. */
async function selectSection(): Promise<void> {
  const section = canvas().locator(".site-section");
  const box = await section.boundingBox();
  if (box === null) throw new Error("Section not visible");
  await section.click({ force: true, position: { x: 10, y: box.height - 16 } });
  await expect(panel().getByRole("heading", { name: "Section", exact: true })).toBeVisible();
}

/** Selects the heading by clicking past the end of its text, at its bottom edge. */
async function selectHeading(): Promise<void> {
  const heading = canvas().locator(".site-heading");
  const box = await heading.boundingBox();
  if (box === null) throw new Error("Heading not visible");
  await heading.click({ position: { x: box.width * 0.97, y: box.height - 2 } });
  await expect(panel().getByRole("heading", { name: "Heading", exact: true })).toBeVisible();
}

/** Presses on `handle` and moves the mouse `by` pixels down (up if negative), without letting go. */
async function dragBy(handle: ReturnType<typeof grip>, by: number): Promise<void> {
  const box = await handle.boundingBox();
  if (box === null) throw new Error("Grip not visible");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + by, { steps: 8 });
}

test("drags a section's padding as one step, shown live; Esc cancels a drag", async () => {
  const section = canvas().locator(".site-section");
  await selectSection();

  // Far into the section: the largest size.
  await dragBy(grip("padding", "top"), 300);
  await expect(canvas().locator(".wf-grip-readout")).toHaveText("Padding Top: XL");
  await expect(section).toHaveClass(/(^| )px-4 pt-32 pb-16( |$)/);
  await expect(section).toHaveCSS("padding-top", "128px");
  await page.mouse.up();

  await expect(steps()).toHaveCount(2);
  await expect(steps().first()).toHaveText("Changed Section padding");
  await expect(canvas().locator(".wf-grip-readout")).toHaveCount(0);
  const top = panel().getByRole("radiogroup", { name: "Padding Top" });
  await panel().getByRole("tab", { name: "Style" }).click();
  await expect(top.getByRole("radio", { name: "XL", exact: true })).toHaveAttribute(
    "aria-checked",
    "true",
  );

  // Esc cancels a drag even with Shift held: no step, the padding as it was.
  await dragBy(grip("padding", "top"), -300);
  await page.keyboard.down("Shift");
  await page.keyboard.press("Escape");
  await page.keyboard.up("Shift");
  await page.mouse.up();
  await expect(section).toHaveCSS("padding-top", "128px");
  await expect(steps()).toHaveCount(2);
  // The section stays selected.
  await expect(panel().getByRole("heading", { name: "Section", exact: true })).toBeVisible();
});

test("drags a heading's margin on Mobile; hidden in Content mode", async () => {
  await page
    .getByRole("toolbar", { name: "Canvas" })
    .getByRole("radio", { name: "Mobile" })
    .click();
  await selectHeading();
  await expect(grip("padding", "top")).toHaveCount(0);

  await dragBy(grip("margin", "bottom"), 200);
  await page.mouse.up();

  await expect(steps().first()).toHaveText("Changed Heading margin on Mobile");
  await expect(canvas().locator(".site-heading")).toHaveClass(/(^| )max-md:mb-24( |$)/);

  await page.getByRole("radio", { name: "Content", exact: true }).click();
  await expect(canvas().locator(".wf-grip")).toHaveCount(0);
});

test("keeps clicks on a selected section's padding and its elements selecting them", async () => {
  await selectSection();
  await expect(grip("padding", "bottom")).toBeVisible();

  // An element inside the selected section, then the section again by its padding.
  await selectHeading();
  await selectSection();
  // In the middle of its bottom padding too, where the grips are not.
  await selectHeading();
  const section = canvas().locator(".site-section");
  const box = await section.boundingBox();
  if (box === null) throw new Error("Section not visible");
  await section.click({ force: true, position: { x: box.width / 2, y: box.height - 16 } });
  await expect(panel().getByRole("heading", { name: "Section", exact: true })).toBeVisible();
  // Only the opened page: selecting is no step.
  await expect(steps()).toHaveCount(1);
});
