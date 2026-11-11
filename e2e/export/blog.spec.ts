import { join } from "node:path";
import { pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { BLOG_SITE_DIR } from "./exported-site.js";

// A Blog's post (6.10a, ADR 0025) on an exported site, opened from disk: in the Blog's folder,
// inside the Blog's design, its fields filled in, its links one folder up.

const post = pathToFileURL(join(BLOG_SITE_DIR, "blog", "spring-opening.html")).href;

test("shows the post inside its Blog's design: its title, date and picture", async ({ page }) => {
  await page.goto(post);

  await expect(page.getByRole("heading", { name: "Spring opening" })).toBeVisible();
  await expect(page.locator("time[datetime='2026-11-10']")).toHaveText("10 November 2026");
  const picture = page.locator("main img").first();
  await expect(picture).toBeVisible();
  expect(
    await picture.evaluate((image) => (image as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0);
  await expect(page.getByText("We open on Saturday.")).toBeVisible();
  // The Header and Footer around the design, as on every page.
  await expect(page.locator("header.site-header")).toBeVisible();
  await expect(page.locator("footer")).toBeVisible();
});

test("links back to the Home page, one folder up, and isn't in the menu", async ({ page }) => {
  await page.goto(post);

  await expect(page.locator("nav").getByRole("link", { name: "Spring opening" })).toHaveCount(0);
  await page.getByRole("link", { name: "Back to Home" }).click();
  await expect(page).toHaveURL(/\/index\.html$/);
});

test("passes axe", async ({ page }) => {
  await page.goto(post);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
