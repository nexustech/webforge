import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { ProjectStore } from "@webforge/storage";
import { themePreset } from "@webforge/themes";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
import type { RendererWindow } from "./sites.js";

// The Theme tab (2.3a): switching the theme asks first, saying how many pages it changes, and is
// one undo step; a colour hard to read says so under it (WCAG AA).

let dir: string;
let sitePath: string;
let app: ElectronApplication | undefined;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-theme-"));
  sitePath = join(dir, "Theme.wforge");
  ProjectStore.create(sitePath, { name: "Theme" }).close();
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

/** The open site's theme, as the main process keeps it. */
async function themeOf(page: Page): Promise<{ preset: string; colors: Record<string, unknown> }> {
  const read = (await page.evaluate(() =>
    (window as unknown as RendererWindow).webforge.project.readSite(),
  )) as { site: { theme: { preset: string; colors: Record<string, unknown> } } };
  return read.site.theme;
}

/** The app on the site, its Theme tab shown. */
async function openTheme(): Promise<Page> {
  app = await launchDesktopApp({ args: [sitePath] });
  const page = await app.firstWindow();
  await waitForCanvas(page);
  await page
    .getByRole("region", { name: "Right panels" })
    .getByRole("tab", { name: "Theme", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Theme: Light" })).toBeVisible();
  return page;
}

test("switching the theme asks first, with the pages it changes, and is one undo step", async () => {
  const page = await openTheme();
  const canvasHeading = page.frameLocator(".editor__canvas iframe").locator("h1").first();

  await page.getByRole("combobox", { name: "Theme", exact: true }).selectOption("bistro");
  const ask = page.getByRole("alertdialog", { name: "Switch to the theme 'Bistro'?" });
  // Every page: the home page and Page not found.
  await expect(ask).toContainText("This changes 2 pages.");
  await ask.getByRole("button", { name: "Cancel" }).click();
  await expect(ask).toHaveCount(0);
  expect((await themeOf(page)).preset).toBe("light");

  await page.getByRole("combobox", { name: "Theme", exact: true }).selectOption("bistro");
  await page.getByRole("alertdialog").getByRole("button", { name: "Switch Theme" }).click();
  await expect(page.getByRole("heading", { name: "Theme: Bistro" })).toBeVisible();
  // The main process has the site once the change reaches it.
  await expect.poll(async () => (await themeOf(page)).preset).toBe("bistro");
  // The canvas takes the theme's heading font.
  const heading = themePreset("bistro")?.fonts.heading.family ?? "";
  await expect(canvasHeading).toHaveCSS("font-family", new RegExp(heading));

  await page.getByRole("tab", { name: "Undo History" }).click();
  // Newest first.
  await expect(page.locator(".undo-history__step")).toHaveText([
    "Changed theme to 'Bistro'",
    "Opened page",
  ]);
  await page.getByRole("banner").getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Theme: Light" })).toBeVisible();
  await expect.poll(async () => (await themeOf(page)).preset).toBe("light");
});

test("a colour hard to read says so under it, and a readable one doesn't", async () => {
  const page = await openTheme();
  const brand = page.locator('[data-field="color.primary"]');
  await expect(brand.getByRole("listitem")).toHaveCount(0);

  const hex = page.getByRole("textbox", { name: "Brand hex code" });
  // Typed as a person types it (a filled-in value skips React's input events); the # is optional.
  await hex.selectText();
  await page.keyboard.type("d8d4ff");
  await page.keyboard.press("Enter");
  await page.getByRole("alertdialog").getByRole("button", { name: "Change Colour" }).click();

  await expect(
    brand.getByText(/Hard to read with Surface: [\d.]+:1, needs 4\.5:1\./),
  ).toBeVisible();
  await expect(hex).toHaveValue("#d8d4ff");
  await page.getByRole("tab", { name: "Undo History" }).click();
  await expect(page.locator(".undo-history__step").first()).toHaveText("Changed brand colour");
});
