import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp } from "./launch.js";

// The canvas toolbar (1.15, F-ED-8): device views, a custom width and the page shown, none of
// them an undo step (U6).

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  await expect(canvas().locator("h1")).toHaveText("Welcome to our business");
});

test.afterEach(async () => {
  await app.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const toolbar = () => page.getByRole("toolbar", { name: "Canvas" });
/** The page's width inside the canvas, in CSS pixels, whatever the zoom. */
const pageWidth = () =>
  canvas()
    .locator("body")
    .evaluate((body) => body.ownerDocument.documentElement.clientWidth);
const steps = () => page.locator(".undo-history__step");

test("switches device views and widths at once, without undo steps", async () => {
  await expect.poll(pageWidth).toBe(1280);

  await toolbar().getByRole("radio", { name: "Mobile" }).click();
  await expect.poll(pageWidth).toBe(375);
  await expect(toolbar().getByRole("spinbutton", { name: "Canvas width in pixels" })).toHaveValue(
    "375",
  );

  const width = toolbar().getByRole("spinbutton", { name: "Canvas width in pixels" });
  await width.fill("900");
  await width.press("Enter");
  await expect.poll(pageWidth).toBe(900);
  await expect(toolbar().getByRole("radio", { name: "Desktop" })).toHaveAttribute(
    "aria-checked",
    "false",
  );

  await toolbar().getByRole("combobox", { name: "Page shown" }).selectOption("Page not found");
  await expect(canvas().locator("h1")).toHaveText("Sorry, this page doesn't exist");

  await expect(steps()).toHaveText(["Opened page"]);
});
