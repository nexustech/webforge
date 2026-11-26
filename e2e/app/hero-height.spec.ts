import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, waitForCanvas } from "./launch.js";

// A Whole screen Hero on the canvas (HH-4): as tall as the part of the page in view, less the
// Header's band, at each device view, and steady. The canvas's frame grows with its page, so a
// height taken from the frame's own window would keep growing.

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  await waitForCanvas(page);
  await expect(canvas().locator("h1")).toHaveText("Welcome to our business");
});

test.afterEach(async () => {
  await app?.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const left = () => page.getByRole("region", { name: "Left panels" });
const right = () => page.getByRole("region", { name: "Right panels" });
const toolbar = () => page.getByRole("toolbar", { name: "Canvas" });

/** The Hero's height, the Header's, the window's height the canvas gives, and the page's. */
const sizes = () =>
  canvas()
    .locator("body")
    .evaluate((body) => {
      const doc = body.ownerDocument;
      const height = (selector: string) =>
        doc.querySelector(selector)?.getBoundingClientRect().height ?? 0;
      return {
        hero: height(".site-hero"),
        header: height("header.site-header"),
        window: Number.parseFloat(
          getComputedStyle(doc.documentElement).getPropertyValue("--wf-viewport-h"),
        ),
        page: doc.documentElement.scrollHeight,
      };
    });

test("draws a Whole screen Hero as tall as the canvas shows, less the Header, and steady (HH-4)", async () => {
  // The starter page opens with its Hero, under the Header's own band.
  await left().getByRole("treeitem", { name: /^Hero/ }).click();
  await expect(right().getByRole("heading", { name: "Hero", exact: true })).toBeVisible();
  await right().getByRole("tab", { name: "Style" }).click();
  await right().locator('[data-field="height"] select').selectOption("screen");

  for (const device of ["Desktop", "Tablet", "Mobile"] as const) {
    await toolbar().getByRole("radio", { name: device }).click();
    await expect(toolbar().getByRole("radio", { name: device })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    // The window less the Header: the two fill the part of the page in view.
    await expect
      .poll(async () => {
        const at = await sizes();
        return Math.abs(at.hero + at.header - at.window);
      }, device)
      .toBeLessThan(2);
    // And stays so: the page doesn't grow with it.
    const before = await sizes();
    await canvas()
      .locator("body")
      .evaluate(() => new Promise((resolve) => setTimeout(resolve, 600)));
    expect((await sizes()).page, device).toBe(before.page);
  }
});
