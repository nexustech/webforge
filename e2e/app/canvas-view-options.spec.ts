import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp } from "./launch.js";

// The canvas's View menu (1.33, F-ED-25): outlines around every element, margins and padding on
// hover, element names and room below the page. They only change what the canvas shows: never
// the page, and never an undo step.

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
  await expect(canvas().locator("h1")).toHaveText("Welcome to our business");
});

test.afterEach(async () => {
  await app.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const steps = () => page.locator(".undo-history__step");

/** Turns a View menu option on or off; the menu stays open, so Escape closes it. */
async function toggle(name: string): Promise<void> {
  await page.getByRole("toolbar", { name: "Canvas" }).getByRole("button", { name: "View" }).click();
  await page.getByRole("menuitemcheckbox", { name }).click();
  await page.keyboard.press("Escape");
}

test("shows outlines, element names, spacing on hover and extra space, none an undo step", async () => {
  const before = await steps().count();
  const root = canvas().locator("html");
  const wrapper = canvas()
    .locator("[data-puck-component]")
    .filter({ has: canvas().locator("h1") });

  // Outlines are on by default: a dashed line around every element.
  await expect(root).toHaveAttribute("data-wf-view-outlines", "");
  await expect(wrapper.first()).toHaveCSS("outline-style", "dashed");
  await toggle("Show outlines");
  await expect(wrapper.first()).not.toHaveCSS("outline-style", "dashed");

  // Element names: one for each element, the Heading's among them.
  await toggle("Show element names");
  await expect(canvas().locator(".wf-view-name", { hasText: "Heading" }).first()).toBeVisible();

  // Spacing on hover: the hovered element's margin and padding.
  await toggle("Show spacing on hover");
  await canvas().locator("h1").hover();
  await expect(canvas().locator(".wf-view-margin")).toHaveCount(1);
  await expect(canvas().locator(".wf-view-padding")).toHaveCount(1);

  // Extra space at the bottom: room below the page's last section, however long the page is.
  const zone = canvas().locator('[data-puck-dropzone="root:default-zone"]');
  await expect(zone).toHaveCSS("padding-bottom", "0px");
  await toggle("Extra space at the bottom");
  await expect(zone).toHaveCSS("padding-bottom", "320px");
  const room = await zone.evaluate((element) => {
    const last = element.lastElementChild?.getBoundingClientRect().bottom ?? 0;
    return element.getBoundingClientRect().bottom - last;
  });
  expect(room).toBeGreaterThanOrEqual(320);

  // Off again: the canvas shows the page alone.
  await toggle("Show element names");
  await expect(canvas().locator(".wf-view-name")).toHaveCount(0);
  await expect(steps()).toHaveCount(before);
});
