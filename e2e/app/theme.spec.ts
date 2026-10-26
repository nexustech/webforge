import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { ProjectStore } from "@webforge/storage";
import { heroPhoto } from "@webforge/test-utils";
import { themePreset } from "@webforge/themes";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";
import type { RendererWindow } from "./sites.js";
import { stubFileDialogs } from "./sites.js";

// The Theme tab (2.3a): switching the theme asks first, saying how many pages it changes, and is
// one undo step; a colour hard to read says so under it (WCAG AA). Theme Studio (2.3b): opened
// from the View menu, a theme card switches the theme the same way, and Ctrl/Cmd+Z undoes it from
// inside the dialog, which shares the site's history (P5).

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

/** The running app; a test calls it once it has launched one. */
function running(): ElectronApplication {
  if (app === undefined) throw new Error("The app is not running");
  return app;
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
  // A built-in theme is read-only (2.22): the first change saves the person's own version.
  await page
    .getByRole("dialog", { name: "Save your own version of 'Light'?" })
    .getByRole("button", { name: "Save Theme" })
    .click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Change Colour" }).click();

  await expect(
    brand.getByText(/Hard to read with Surface: [\d.]+:1, needs 4\.5:1\./),
  ).toBeVisible();
  await expect(hex).toHaveValue("#d8d4ff");
  await page.getByRole("tab", { name: "Undo History" }).click();
  await expect(page.locator(".undo-history__step").first()).toHaveText(
    "Saved theme 'Light (my version)'",
  );
});

test("Theme Studio opens from the View menu, switches theme from a card, and undoes it there", async () => {
  const page = await openTheme();
  await chooseFromMenu(running(), page, "View", "Theme Studio…");
  const studio = page.getByRole("dialog", { name: "Theme Studio" });
  await expect(studio.getByRole("button", { name: /Light/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await studio.getByRole("button", { name: /Atelier/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Switch Theme" }).click();
  await expect(studio.getByRole("button", { name: /Atelier/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect.poll(async () => (await themeOf(page)).preset).toBe("atelier");

  // The card keeps the focus: the site's undo, from inside Theme Studio.
  await page.keyboard.press("ControlOrMeta+z");
  await expect(studio.getByRole("button", { name: /Light/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect.poll(async () => (await themeOf(page)).preset).toBe("light");
});

test("a photo in Media proposes brand colours, read on this computer, used as one step (PG-2)", async () => {
  const page = await openTheme();
  const photo = join(dir, "Shop front.jpg");
  writeFileSync(photo, heroPhoto());
  await stubFileDialogs(running(), photo);
  await page.getByRole("tab", { name: "Media" }).click();
  await page
    .getByRole("region", { name: "Media" })
    .getByRole("button", { name: "Add images or files…" })
    .click();
  await expect(
    page.getByRole("region", { name: "Media" }).getByRole("button", { name: "Shop front.jpg" }),
  ).toBeVisible();

  await chooseFromMenu(running(), page, "View", "Theme Studio…");
  const studio = page.getByRole("dialog", { name: "Theme Studio" });
  await studio.getByRole("tab", { name: "Colours" }).click();
  await studio.getByRole("button", { name: "Colours from an image…" }).click();
  const picker = page.getByRole("dialog", { name: "Choose an image" });
  await expect(picker.getByRole("option", { name: /Shop front/ })).toBeVisible();
  await page.keyboard.press("Enter");

  // The canvas could read the thumbnail (Media's scheme allows CORS): a proposal, not a problem.
  await expect(studio.getByRole("list", { name: "Colours from Shop front.jpg" })).toBeVisible();
  const before = (await themeOf(page)).colors.primary;
  await studio.getByRole("button", { name: "Use These Colours" }).click();
  // A built-in theme is read-only (2.22): the first change saves the person's own version.
  await page
    .getByRole("dialog", { name: "Save your own version of 'Light'?" })
    .getByRole("button", { name: "Save Theme" })
    .click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Use Colours" }).click();
  await expect.poll(async () => (await themeOf(page)).colors.primary).not.toEqual(before);

  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Undo History" }).click();
  await expect(page.locator(".undo-history__step").first()).toHaveText(
    "Saved theme 'Light (my version)'",
  );
});

test("a change to a built-in theme saves the person's own, which another site can use (2.22)", async () => {
  // Both sites on one computer: the same user data.
  const userData = join(dir, "user-data");
  app = await launchDesktopApp({ args: [sitePath], userDataDir: userData });
  let page = await app.firstWindow();
  await waitForCanvas(page);
  await page
    .getByRole("region", { name: "Right panels" })
    .getByRole("tab", { name: "Theme", exact: true })
    .click();

  await page.getByRole("combobox", { name: "Card style" }).selectOption("raised");
  const save = page.getByRole("dialog", { name: "Save your own version of 'Light'?" });
  await save.getByRole("textbox", { name: "Theme name" }).fill("Bakery");
  await save.getByRole("button", { name: "Save Theme" }).click();
  await expect(page.getByRole("heading", { name: "Theme: Bakery" })).toBeVisible();
  await expect
    .poll(async () => (await themeOf(page)) as unknown)
    .toMatchObject({ preset: "light", own: { name: "Bakery" } });
  await app.close();

  // Another site on the same computer lists it first, and uses it.
  const other = join(dir, "Other.wforge");
  ProjectStore.create(other, { name: "Other" }).close();
  app = await launchDesktopApp({ args: [other], userDataDir: userData });
  page = await app.firstWindow();
  await waitForCanvas(page);
  await page
    .getByRole("region", { name: "Right panels" })
    .getByRole("tab", { name: "Theme", exact: true })
    .click();
  const themes = page.getByRole("combobox", { name: "Theme", exact: true });
  await expect(themes.locator("option").first()).toHaveText("Bakery");
  await themes.selectOption({ label: "Bakery" });
  await page.getByRole("alertdialog").getByRole("button", { name: "Switch Theme" }).click();
  await expect(page.getByRole("heading", { name: "Theme: Bakery" })).toBeVisible();
  await expect
    .poll(async () => (await themeOf(page)) as unknown)
    .toMatchObject({ own: { name: "Bakery" } });
});
