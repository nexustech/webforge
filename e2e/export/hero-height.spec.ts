import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { HERO_HEIGHT_SITE_DIR } from "./exported-site.js";

// A Whole screen Hero (HH-4) on an exported site, opened from disk: it fills the window under a
// Header with its own band, and the whole window with the Header joined to it.

/** Where the Header and the Hero are on the page, and the window's height. */
const placed = (page: Page) =>
  page.evaluate(() => {
    const header = document.querySelector("header.site-header")?.getBoundingClientRect();
    const hero = document.querySelector(".site-hero")?.getBoundingClientRect();
    return {
      headerBottom: header?.bottom ?? Number.NaN,
      heroTop: hero?.top ?? Number.NaN,
      heroBottom: hero?.bottom ?? Number.NaN,
      window: window.innerHeight,
    };
  });

for (const [width, height] of [
  [960, 600],
  [390, 844],
] as const) {
  test(`fills the window under a Header with its own band, at ${width} × ${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto(pathToFileURL(join(HERO_HEIGHT_SITE_DIR, "own", "index.html")).href);

    // Below the Header, to the window's foot: the Header's real height, as the script measured it.
    await expect.poll(async () => (await placed(page)).heroBottom).toBeCloseTo(height, 0);
    const at = await placed(page);
    expect(at.heroTop).toBeCloseTo(at.headerBottom, 0);
    expect(at.heroTop).toBeGreaterThan(0);
  });

  test(`fills the whole window with the Header joined to it, at ${width} × ${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto(pathToFileURL(join(HERO_HEIGHT_SITE_DIR, "joined", "index.html")).href);

    // From the top of the window to its foot, the Header on it and its room inside the height.
    await expect.poll(async () => (await placed(page)).heroBottom).toBeCloseTo(height, 0);
    const at = await placed(page);
    expect(at.heroTop).toBeCloseTo(0, 0);
    expect(at.headerBottom).toBeLessThan(at.heroBottom);
  });
}
