import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { exportedPageUrl } from "./exported-site.js";

// The exported fixture site, opened from disk (file://) in Chromium, Firefox and WebKit with the
// network blocked (X1, C8): it must look and work right without any server or external request.

let externalRequests: string[] = [];

async function blockNetwork(context: BrowserContext): Promise<void> {
  externalRequests = [];
  await context.route(/^(?!file:)/, async (route) => {
    externalRequests.push(route.request().url());
    await route.abort();
  });
}

async function open(page: Page, name: string): Promise<void> {
  await blockNetwork(page.context());
  await page.goto(exportedPageUrl(name));
  await page.waitForLoadState("load");
}

test.afterEach(() => {
  expect(externalRequests, "requests that left the computer").toEqual([]);
});

test.describe("exported site from disk", () => {
  test("loads its styles, fonts, image and script from the export folder", async ({ page }) => {
    await open(page, "index.html");

    await expect(page).toHaveTitle("Rosa's Bakery");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Baked fresh every morning");
    const loadedFonts = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts]
        .filter((font) => font.status === "loaded")
        .map((font) => `${font.family.replaceAll('"', "")} ${font.weight}`);
    });
    expect(loadedFonts).toContain("Inter 700");
    const image = page.getByRole("img", { name: "Green hills under a morning sun" });
    await expect(image).toHaveJSProperty("complete", true);
    expect(await image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    // daisyUI's theme reached the page: the primary button is not the browser default.
    const button = page.getByRole("link", { name: "About us" }).last();
    expect(await button.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
      "rgba(0, 0, 0, 0)",
    );
  });

  test("navigates between pages with relative links", async ({ page }) => {
    await open(page, "index.html");

    await page.getByRole("navigation").getByRole("link", { name: "About us" }).click();

    await expect(page).toHaveURL(/\/about\.html$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("About Rosa's Bakery");
    await expect(page.getByRole("link", { name: "About us", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("opens and closes the mobile menu with the button and Escape", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, "index.html");
    const toggle = page.getByRole("button", { name: "Menu" });
    const home = page.getByRole("navigation").getByRole("link", { name: "Home" });

    await expect(home).toBeHidden();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(home).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(home).toBeHidden();
    await expect(toggle).toBeFocused();
  });

  test("opens a dropdown in the mobile menu by keyboard; Escape closes it before the menu", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, "index.html");
    const menu = page.getByRole("button", { name: "Menu" });
    const dropdown = page.getByRole("navigation").getByRole("button", { name: "Visit us" });
    const questions = page.getByRole("navigation").getByRole("link", { name: "Questions" });

    await menu.click();
    await expect(dropdown).toHaveAttribute("aria-expanded", "false");
    await expect(questions).toBeHidden();
    await dropdown.focus();
    await page.keyboard.press("Enter");
    await expect(dropdown).toHaveAttribute("aria-expanded", "true");
    await expect(questions).toBeVisible();

    // Screen readers get the open menu and dropdown right too.
    const results = await new AxeBuilder({ page }).include("nav").analyze();
    expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);

    await page.keyboard.press("Escape");
    await expect(dropdown).toHaveAttribute("aria-expanded", "false");
    await expect(dropdown).toBeFocused();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeFocused();
  });

  test("shows the menu's dropdown, button and new-tab link on a wide screen", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, "index.html");
    const navigation = page.getByRole("navigation");
    const dropdown = navigation.getByRole("button", { name: "Visit us" });

    await expect(navigation.getByRole("link", { name: "Order a cake" })).toHaveAttribute(
      "href",
      "about.html",
    );
    await dropdown.click();
    await expect(navigation.getByRole("link", { name: "Find us" })).toHaveAttribute(
      "target",
      "_blank",
    );
    await expect(navigation.getByRole("link", { name: "Questions" })).toHaveAttribute(
      "href",
      "index.html#questions",
    );
    // A click elsewhere closes it.
    await page.getByRole("main").click({ position: { x: 5, y: 5 } });
    await expect(dropdown).toHaveAttribute("aria-expanded", "false");
    await expect(navigation.getByRole("link", { name: "Find us" })).toBeHidden();

    // So does focus moving on past it (by focus(): WebKit doesn't tab to links by default).
    await dropdown.focus();
    await page.keyboard.press("Enter");
    await expect(dropdown).toHaveAttribute("aria-expanded", "true");
    await navigation.getByRole("link", { name: "Order a cake" }).focus();
    await expect(dropdown).toHaveAttribute("aria-expanded", "false");
  });

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("opens the mobile menu while its button has the focus", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await open(page, "index.html");
      const home = page.getByRole("navigation").getByRole("link", { name: "Home" });

      await expect(home).toBeHidden();
      await page.getByRole("button", { name: "Menu" }).focus();
      await expect(home).toBeVisible();
    });

    test("opens a dropdown while it has the focus", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await open(page, "index.html");
      const navigation = page.getByRole("navigation");
      const questions = navigation.getByRole("link", { name: "Questions" });

      await expect(questions).toBeHidden();
      await navigation.getByRole("button", { name: "Visit us" }).focus();
      await expect(questions).toBeVisible();
    });
  });

  test("opens an FAQ answer with the keyboard", async ({ page }) => {
    await open(page, "index.html");
    const question = page.getByText("When are you open?");
    const answer = page.getByText("Tuesday to Sunday, 7am to 3pm.");

    await expect(answer).toBeHidden();
    await question.focus();
    await page.keyboard.press("Enter");

    await expect(answer).toBeVisible();
  });

  for (const name of ["index.html", "about.html"]) {
    test(`has no serious accessibility violations on ${name}`, async ({ page }) => {
      await open(page, name);

      const results = await new AxeBuilder({ page }).analyze();
      const serious = results.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical",
      );

      expect(serious.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
    });
  }
});
