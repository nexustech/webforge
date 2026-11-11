import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { BLOG_SITE_DIR } from "./exported-site.js";

// A Blog (6.10a, 6.10b, ADR 0025) on an exported site, opened from disk: a post in the Blog's
// folder inside its design, and the Blog's own pages and feed, which the export writes.

const file = (...path: string[]) => pathToFileURL(join(BLOG_SITE_DIR, ...path)).href;
const post = file("blog", "spring-opening.html");

/** No accessibility problems axe can find on the page shown. */
async function passesAxe(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

test("shows the post inside its Blog's design: its title, date, picture and tags", async ({
  page,
}) => {
  await page.goto(post);

  await expect(page.getByRole("heading", { name: "Spring opening" })).toBeVisible();
  await expect(page.locator("time[datetime='2026-11-10']")).toHaveText("10 November 2026");
  const picture = page.locator("main img").first();
  await expect(picture).toBeVisible();
  // Loaded from the export folder, once the browser has fetched it (it loads lazily).
  await expect
    .poll(() => picture.evaluate((image) => (image as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  await expect(page.getByText("We open on Saturday.")).toBeVisible();
  await expect(page.locator("header.site-header")).toBeVisible();
  await expect(page.locator("footer")).toBeVisible();
  await passesAxe(page);
});

test("links back to the Home page, one folder up, and isn't in the menu", async ({ page }) => {
  await page.goto(post);

  await expect(page.locator("nav").getByRole("link", { name: "Spring opening" })).toHaveCount(0);
  await page.getByRole("link", { name: "Back to Home" }).click();
  await expect(page).toHaveURL(/\/index\.html$/);
});

test("goes from a post's tag to the tag's page, and from there to the post", async ({ page }) => {
  await page.goto(post);

  await page
    .getByRole("list", { name: "Tags" })
    .getByRole("link", { name: "Opening times" })
    .click();
  await expect(page).toHaveURL(/\/blog\/tag\/opening-times\.html$/);
  await expect(page.getByRole("heading", { name: "Posts tagged 'Opening times'" })).toBeVisible();
  await passesAxe(page);
  await page.getByRole("link", { name: "Spring opening" }).click();
  await expect(page).toHaveURL(/\/blog\/spring-opening\.html$/);
});

test("lists the Blog's posts on its own page, with the site's Header and Footer", async ({
  page,
}) => {
  await page.goto(file("blog", "index.html"));

  await expect(page.getByRole("heading", { name: "Blog", level: 1 })).toBeVisible();
  await expect(page.getByText("Doors open at nine.")).toBeVisible();
  await expect(page.locator("header.site-header")).toBeVisible();
  await passesAxe(page);
});

test("goes from the menu to the Blog's own page, from a post in its folder too (#940)", async ({
  page,
}) => {
  await page.goto(post);

  await page.locator("nav").getByRole("link", { name: "News" }).first().click();
  await expect(page).toHaveURL(/\/blog\/index\.html$/);
  await expect(page.getByRole("heading", { name: "Blog", level: 1 })).toBeVisible();
});

test("links its feed from every page, and the feed lists the post at its whole address", async ({
  page,
}) => {
  await page.goto(file("index.html"));

  await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveAttribute(
    "href",
    "blog/feed.xml",
  );
  const feed = readFileSync(join(BLOG_SITE_DIR, "blog", "feed.xml"), "utf8");
  expect(feed).toContain("<link>https://rosas.example/blog/spring-opening.html</link>");
  expect(feed).toContain("<pubDate>Tue, 10 Nov 2026 00:00:00 GMT</pubDate>");
});
