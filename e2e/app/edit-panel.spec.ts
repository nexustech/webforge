import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp } from "./launch.js";

// The Edit panel (1.14): the selected element's fields, each change one labelled undo step.

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
  await expect(canvas().locator("style[data-webforge-site-css]")).toHaveCount(1);
});

test.afterEach(async () => {
  await app.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
/** The editor's right-hand panels, where the Edit panel is (not Puck's own field UI). */
const panel = () => page.getByRole("region", { name: "Right panels" });
const steps = () => page.locator(".undo-history__step");
/** A device view in the canvas toolbar (1.15). */
const deviceView = (name: "Desktop" | "Mobile") =>
  page.getByRole("toolbar", { name: "Canvas" }).getByRole("radio", { name });

/**
 * Selects the heading by clicking past the end of its text (clicking the text edits it), at its
 * bottom edge: once it is selected, its quick actions sit over its top edge, below the Header.
 */
async function selectHeading(): Promise<void> {
  const heading = canvas().locator(".site-heading");
  const box = await heading.boundingBox();
  if (box === null) throw new Error("Heading not visible");
  await heading.click({ position: { x: box.width * 0.97, y: box.height - 2 } });
}

test.describe("Edit panel", () => {
  test("asks for a selection, then shows the selected element's fields", async () => {
    await expect(panel().getByText("Select an element to edit it")).toBeVisible();

    await selectHeading();

    await expect(panel().getByRole("heading", { name: "Heading", exact: true })).toBeVisible();
    await expect(panel().getByLabel("Text", { exact: true })).toHaveValue(
      "Welcome to our business",
    );
  });

  test("changes the heading's size as one step, on the canvas too", async () => {
    await selectHeading();
    await panel().getByRole("tab", { name: "Style" }).click();

    await panel().getByLabel("Size", { exact: true }).selectOption("small");

    await expect(steps().first()).toHaveText("Changed Heading size");
    await expect(canvas().locator("h3.site-heading")).toHaveText("Welcome to our business");
  });

  test("offers the theme's colours by their names, one step a choice (1.37, UX-25)", async () => {
    await selectHeading();
    await panel().getByRole("tab", { name: "Style" }).click();
    await expect(panel().getByRole("radio", { name: "Brand" })).toBeVisible();

    await panel().getByRole("radio", { name: "Second accent" }).click();

    await expect(steps().first()).toHaveText("Changed Heading colour");
    await expect(panel().getByRole("radio", { name: "Second accent" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("makes one step of typing in a text field", async () => {
    await selectHeading();
    const field = panel().getByLabel("Text", { exact: true });

    await field.click();
    await page.keyboard.press("End");
    await page.keyboard.type(" today", { delay: 20 });
    await expect(canvas().locator(".site-heading")).toHaveText("Welcome to our business today");
    // Leaving the field ends the visit.
    await panel().getByRole("tab", { name: "Style" }).click();

    await expect(steps()).toHaveText(["Edited Heading text", "Opened page"]);
  });
});

test("undoes with Ctrl/Cmd+Z in a panel field through the site's history (ADR 0004)", async () => {
  await selectHeading();
  const field = panel().getByLabel("Text", { exact: true });
  await field.click();
  await page.keyboard.press("End");
  await page.keyboard.type("!", { delay: 20 });
  await expect(steps().first()).toHaveText("Edited Heading text");

  await page.keyboard.press("ControlOrMeta+z");

  await expect(field).toHaveValue("Welcome to our business");
  await expect(canvas().locator(".site-heading")).toHaveText("Welcome to our business");
  await expect(page.locator('.undo-history__step[aria-current="step"]')).toHaveText("Opened page");
});

/**
 * Selects the first Section by clicking its bottom padding, once the canvas has finished resizing
 * to the device view (Puck animates it).
 */
async function selectSection(): Promise<void> {
  const section = canvas().locator(".site-section");
  let last = "";
  await expect
    .poll(async () => {
      const box = JSON.stringify(await section.boundingBox());
      const settled = box === last;
      last = box;
      return settled;
    })
    .toBe(true);
  const box = await section.boundingBox();
  if (box === null) throw new Error("Section not visible");
  // Inside its bottom padding (32 px or more), clear of the edge: at a small zoom 4 px is a pixel.
  await section.click({ force: true, position: { x: 10, y: box.height - 16 } });
  await expect(panel().getByRole("heading", { name: "Section", exact: true })).toBeVisible();
}

test("sets a padding for the Mobile view only, marked in the panel (F-ED-4)", async () => {
  const section = canvas().locator(".site-section");
  await deviceView("Mobile").click();
  await selectSection();

  // A new site's Section has Medium padding above and below, so each side has its own row (1.32).
  const top = panel().getByRole("radiogroup", { name: "Padding Top" });
  await top.getByRole("radio", { name: "S", exact: true }).click();

  await expect(steps().first()).toHaveText("Changed Section padding on Mobile");
  await expect(panel().getByText("Mobile only")).toBeVisible();
  await expect(section).toHaveClass(/(^| )px-4 pt-8 pb-16 md:py-16( |$)/);

  // The canvas toolbar keeps the selection when the view changes (U3): the panel shows Desktop's.
  await deviceView("Desktop").click();
  await expect(panel().getByRole("heading", { name: "Section", exact: true })).toBeVisible();
  await expect(panel().getByText("Mobile only")).toHaveCount(0);
  await expect(top.getByRole("radio", { name: "M", exact: true })).toHaveAttribute(
    "aria-checked",
    "true",
  );

  // Another mode re-renders the canvas: the view stays, rather than one picked for the window.
  await deviceView("Mobile").click();
  await page.getByRole("radio", { name: "Content", exact: true }).click();
  await expect(deviceView("Mobile")).toHaveAttribute("aria-checked", "true");
  await expect(section).toHaveCSS("padding-top", "32px");
});
