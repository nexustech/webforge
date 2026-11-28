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

/** Where the box of the Hero titled `title` sits in its row: their left edges and widths. */
const placeOf = (page: Page, title: string) =>
  page.locator(".site-hero h1", { hasText: title }).evaluate((heading) => {
    const box = heading.parentElement?.getBoundingClientRect();
    const row = heading.closest(".hero-content")?.getBoundingClientRect();
    const hero = heading.closest(".site-hero")?.getBoundingClientRect();
    return {
      inset: (box?.left ?? 0) - (row?.left ?? 0),
      row: row?.width ?? 0,
      rowLeft: (row?.left ?? 0) - (hero?.left ?? 0),
      // How far the box's middle is from the section's.
      offCentre:
        (box?.left ?? 0) + (box?.width ?? 0) / 2 - ((hero?.left ?? 0) + (hero?.width ?? 0) / 2),
    };
  });

test("sets a left Hero's text at its row's left edge behind its picture (#1658)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(pathToFileURL(join(HERO_OVERLAY_SITE_DIR, "index.html")).href);

  // Content width Wide: the row is its 1,184 px, centred, and the box at its left, inside its padding.
  const narrow = await placeOf(page, "Hero left-narrow-wide");
  expect(narrow.row).toBeGreaterThan(1100);
  expect(narrow.inset).toBeLessThanOrEqual(32);
  // Full: the row is the window's width, the wide box at its left too.
  const full = await placeOf(page, "Hero left-wide-full");
  expect(full.row).toBeGreaterThan(1300);
  expect(full.inset).toBeLessThanOrEqual(32);
  expect(narrow.offCentre).toBeLessThan(-200);
  // Centred, as before: the box in the middle of the section.
  const centred = await placeOf(page, "Hero chosen");
  expect(Math.abs(centred.offCentre)).toBeLessThanOrEqual(1);

  // On a phone, nothing scrolls sideways, even at Full, with the same margins as a centred one.
  await page.setViewportSize({ width: 375, height: 667 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  const phone = await placeOf(page, "Hero left-wide-full");
  // A long text fills the phone's width, centred or not: the same margins as one that's centred.
  const centredPhone = await placeOf(page, "Hero text-narrow-wide");
  expect(phone.row).toBeLessThanOrEqual(375);
  expect(phone.rowLeft + phone.inset).toBe(centredPhone.rowLeft + centredPhone.inset);
});
