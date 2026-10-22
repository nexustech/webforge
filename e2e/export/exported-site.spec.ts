import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { priceList } from "@webforge/test-utils";
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
  test("links to the price list, copied byte for byte, in a new tab (1.28)", async ({ page }) => {
    await open(page, "about.html");

    const link = page.getByRole("link", { name: "Price list (PDF)" });
    await expect(link).toHaveAttribute("target", "_blank");
    // The browser resolves the link from the page on disk to the exported file.
    const url = await link.evaluate((anchor: HTMLAnchorElement) => anchor.href);
    expect(url).toMatch(/^file:.*\/files\/price-list\.pdf$/);
    expect([...readFileSync(fileURLToPath(url))]).toEqual([...priceList()]);
  });

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
