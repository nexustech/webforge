import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";

// A kind's look on the canvas (3.12, CT-1; #622): set in Theme Studio › Components, it restyles
// every item of the kind that sets nothing of its own, as soon as Theme Studio closes. The product
// owner's steps from #614: Features › Background → Accent.

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

test("a kind's look set in Theme Studio shows on an item without its own, once it closes", async () => {
  // A Features section, setting no background of its own.
  await left().getByRole("button", { name: "Features", exact: true }).click();
  const features = canvas().locator(".site-features");
  await expect(features).toHaveCount(1);
  await expect(features).not.toHaveClass(/bg-secondary!/);

  await chooseFromMenu(app, page, "Site", "Theme Studio…");
  const studio = page.getByRole("dialog", { name: "Theme Studio" });
  await studio.getByRole("tab", { name: "Components" }).click();
  // The kinds are a list in the bar at the top (CT-11).
  await studio
    .getByRole("combobox", { name: "Sections and elements" })
    .selectOption({ value: "Features" });
  await studio
    .getByRole("region", { name: "Features" })
    .locator('[data-field="lookBackground"]')
    .getByRole("radio", { name: "Accent", exact: true })
    .click();
  // A draft until applied (4.10): the canvas has nothing of it yet.
  await expect(features).not.toHaveClass(/bg-secondary!/);
  // In the bar at the bottom, always in view (CT-11).
  await studio.getByRole("button", { name: "Apply Changes" }).click();
  // A built-in theme is changed as the person's own copy of it, saved unasked (2.23, LF-15).
  // It restyles every Features on the site, so it asks first (D7).
  await page
    .getByRole("alertdialog", { name: "Change how every Features looks?" })
    .getByRole("button", { name: "Change Look" })
    .click();

  await studio.getByRole("button", { name: "Close", exact: true }).click();
  await expect(studio).toHaveCount(0);

  // The look's background, on the canvas: Accent is the theme's secondary colour.
  await expect(features).toHaveClass(/bg-secondary!/);
});

test("Theme Studio draws its samples' buttons as links, not greyed for want of one (#1256)", async () => {
  await chooseFromMenu(app, page, "Site", "Theme Studio…");
  const studio = page.getByRole("dialog", { name: "Theme Studio" });
  const buttonsIn = async (region: string) => {
    const frames = studio.getByRole("region", { name: region }).locator("iframe");
    await expect(frames.first()).toBeAttached();
    const drawn = { links: 0, greyed: 0 };
    for (const frame of await frames.all()) {
      const content = frame.contentFrame();
      await expect(content.locator("body")).not.toBeEmpty();
      drawn.links += await content.locator("a.btn").count();
      drawn.greyed += await content.locator(".btn-disabled").count();
    }
    return drawn;
  };

  // The sample page, over Colours (CT-11): a Hero's and a Call to action's buttons among others.
  await studio.getByRole("tab", { name: "Colours" }).click();
  const sample = await buttonsIn("A sample page in your theme");
  expect(sample.links).toBeGreaterThan(0);
  expect(sample.greyed).toBe(0);

  // A Button's own preview, under Components.
  await studio.getByRole("tab", { name: "Components" }).click();
  await studio
    .getByRole("combobox", { name: "Sections and elements" })
    .selectOption({ value: "Button" });
  const button = await buttonsIn("Button, as it looks in this theme");
  expect(button.links).toBeGreaterThan(0);
  expect(button.greyed).toBe(0);
});
