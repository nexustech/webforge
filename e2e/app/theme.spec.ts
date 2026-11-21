import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { ProjectStore } from "@webforge/storage";
import { heroPhoto } from "@webforge/test-utils";
import { themePreset } from "@webforge/themes";
import { OPEN_WAIT } from "./budget.js";
import { chooseColour } from "./colour-picker.js";
import { launchDesktopApp, removeWhenFree, waitForCanvas } from "./launch.js";
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
  void removeWhenFree(dir);
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
  await expect(ask).toContainText("2 pages of your site will change.");
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

test("a colour hard to read says so under it at once, in words, with a shade that reads (#1174)", async () => {
  const page = await openTheme();
  const brand = page.locator('[data-field="color.primary"]');
  await expect(brand.getByRole("listitem")).toHaveCount(0);
  // Simple mode shows no codes (LF-16): no hex code, and one text size for the site.
  const theme = page.getByRole("region", { name: "Right panels" });
  await expect(theme.getByRole("textbox", { name: /hex code/ })).toHaveCount(0);
  await expect(theme.getByRole("combobox", { name: "Text size" })).toHaveValue("standard");
  await expect(theme.getByText(/\d\s?px\b/)).toHaveCount(0);

  // A pale brand colour, from the picker.
  await chooseColour(page, brand.getByRole("button", { name: "Brand" }), "#d8d4ff");
  // At once, nothing asked (LF-15): its toast says how far it reached, with Undo. A built-in
  // theme is read-only (2.23): the first change saves the person's own version, unasked.
  await expect(page.getByText(/^Brand colour changed on \d+ pages?$/)).toBeVisible();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Before the panel is left, in the words Site Check's row has.
  await expect(brand.getByText("Brand is hard to read on Surface", { exact: true })).toBeVisible();
  await expect
    .poll(async () => (await themeOf(page)) as unknown)
    .toMatchObject({ own: { name: "Light (yours)" } });

  await brand.getByRole("button", { name: "Use a darker shade" }).click();
  await expect(brand.getByRole("listitem")).toHaveCount(0);
  await page.getByRole("tab", { name: "Undo History" }).click();
  await expect(page.locator(".undo-history__step").first()).toHaveText("Changed brand colour");
});

test("Theme Studio opens from the View menu, switches theme from a card, and undoes it there", async () => {
  const page = await openTheme();
  await chooseFromMenu(running(), page, "Site", "Theme Studio…");
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
  // Switched once Version History's version is saved (4.6), while the question may still fade out.
  await expect(page.getByRole("alertdialog")).toHaveCount(0);

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

  await chooseFromMenu(running(), page, "Site", "Theme Studio…");
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
  // At once, nothing asked (LF-15). The change waits for a version of the site saved before it
  // (`beforeUnaskedChange`), written to disk: longer than the poll's 5 s on a busy runner (#1147).
  await expect
    .poll(async () => (await themeOf(page)).colors.primary, { timeout: OPEN_WAIT })
    .not.toEqual(before);

  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Undo History" }).click();
  await expect(page.locator(".undo-history__step").first()).toHaveText(
    "Changed brand colours from 'Shop front.jpg'",
  );
});

test("a change to a built-in theme saves the person's own, which another site can use (2.23)", async () => {
  // Both sites on one computer: the same user data.
  const userData = join(dir, "user-data");
  app = await launchDesktopApp({ args: [sitePath], userDataDir: userData });
  let page = await app.firstWindow();
  await waitForCanvas(page);
  await page
    .getByRole("region", { name: "Right panels" })
    .getByRole("tab", { name: "Theme", exact: true })
    .click();

  // Saved without asking, named after the built-in theme (LF-15).
  await page.getByRole("combobox", { name: "Card style" }).selectOption("raised");
  await expect(page.getByRole("heading", { name: "Theme: Light (yours)" })).toBeVisible();
  await expect
    .poll(async () => (await themeOf(page)) as unknown)
    .toMatchObject({ preset: "light", own: { name: "Light (yours)" } });
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
  await expect(themes.locator("option").first()).toHaveText("Light (yours)");
  await themes.selectOption({ label: "Light (yours)" });
  await page.getByRole("alertdialog").getByRole("button", { name: "Switch Theme" }).click();
  await expect(page.getByRole("heading", { name: "Theme: Light (yours)" })).toBeVisible();
  await expect
    .poll(async () => (await themeOf(page)) as unknown)
    .toMatchObject({ own: { name: "Light (yours)" } });
});
