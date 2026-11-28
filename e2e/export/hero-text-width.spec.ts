import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Page } from "@playwright/test";
import { HERO_OVERLAY_SITE_DIR } from "./exported-site.js";
import { expect, test } from "./test.js";

// The Hero's Text width (#1631) on an exported site, opened from disk: Narrow a reading width,
// Wide as wide as the section's Content width, but never wider than Content width's Wide, with
// nothing wider than a phone's window.

/** The width of the box holding the title and text of the Hero whose title is `title`. */
const copyWidth = (page: Page, title: string) =>
  page
    .locator(".site-hero h1", { hasText: title })
    .evaluate((heading) => heading.parentElement?.getBoundingClientRect().width ?? 0);

test("draws a Hero's text at a reading width, or as wide as its content, at most Wide's", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(pathToFileURL(join(HERO_OVERLAY_SITE_DIR, "index.html")).href);

  const narrow = await copyWidth(page, "Hero text-narrow-wide");
  const wide = await copyWidth(page, "Hero text-wide-wide");
  const full = await copyWidth(page, "Hero text-wide-full");
  // Narrow: about 670 px (max-w-2xl). Wide at Content width Wide: its 1,152 px, less nothing.
  expect(narrow).toBeLessThanOrEqual(672);
  expect(wide).toBeGreaterThan(1100);
  expect(wide).toBeLessThanOrEqual(1152);
  // Wide at Content width Full: never wider than Wide's own.
  expect(full).toBeLessThanOrEqual(1152);
  expect(full).toBeGreaterThanOrEqual(wide - 1);

  // On a phone, both fill the window, and nothing scrolls sideways.
  await page.setViewportSize({ width: 375, height: 667 });
  expect(await copyWidth(page, "Hero text-wide-full")).toBeLessThanOrEqual(375);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
