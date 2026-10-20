import { type ElectronApplication, expect, type Locator, type Page, test } from "@playwright/test";
import { launchDesktopApp } from "./launch.js";

// The canvas shows the page with the site's own CSS (1.12): Tailwind and daisyUI compiled by the
// export pipeline, injected into the canvas iframe, and nothing from the editor's own styles.

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  await expect(canvas().locator(".site-heading")).toBeVisible();
});

test.afterAll(async () => {
  await app.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const canvasFrame = () => {
  const frame = page.frames().find((f) => f !== page.mainFrame());
  if (frame === undefined) throw new Error("No canvas iframe");
  return frame;
};

/** Drags with real mouse events, in small steps, as a user would. */
async function drag(from: Locator, to: Locator): Promise<void> {
  const source = await from.boundingBox();
  const target = await to.boundingBox();
  if (source === null || target === null) throw new Error("Drag source or target not visible");
  const end = { x: target.x + target.width / 2, y: target.y + target.height + 3 };
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 10, source.y + source.height / 2 + 10, {
    steps: 5,
  });
  await page.mouse.move(end.x, end.y, { steps: 25 });
  await page.mouse.move(end.x, end.y + 1, { steps: 2 });
  await page.mouse.up();
}

test.describe("site CSS on the canvas", () => {
  test("styles the page with the site's Tailwind classes and fonts", async () => {
    await expect(canvas().locator("style[data-webforge-site-css]")).toHaveCount(1);
    const heading = canvas().locator(".site-heading");

    // text-4xl, and md:text-5xl at the Desktop width.
    await expect(heading).toHaveCSS("font-size", "48px");
    await expect(heading).toHaveCSS("font-weight", "700");
    await expect(heading).toHaveCSS("font-family", /Inter/);
    // The exported <body> classes: daisyUI's base colours.
    await expect(canvas().locator("body")).toHaveClass(/bg-base-100/);
  });

  test("styles a daisyUI button added to the page", async () => {
    await drag(
      page.getByText("Hero", { exact: true }).first(),
      canvas().locator(".site-section").last(),
    );
    const button = canvas().locator(".btn-primary");
    await expect(button).toBeVisible();

    // Recompiled for the classes the Hero brought: daisyUI's button, in the theme's primary colour.
    await expect
      .poll(() => button.evaluate((element) => getComputedStyle(element).backgroundColor))
      .not.toMatch(/^(rgba\(0, 0, 0, 0\)|transparent)$/);
    await expect(button).not.toHaveCSS("border-radius", "0px");
    await expect(button).toHaveCSS("cursor", "pointer");
  });

  test("lets nothing from the editor's own styles into the canvas", async () => {
    const leaks = await canvasFrame().evaluate(() => ({
      linkedStylesheets: document.querySelectorAll('link[rel="stylesheet"]').length,
      editorRules: [...document.querySelectorAll("style")].filter((style) =>
        /\.(?:editor|app|undo-history)__/.test(style.textContent ?? ""),
      ).length,
    }));

    expect(leaks).toEqual({ linkedStylesheets: 0, editorRules: 0 });
  });
});
