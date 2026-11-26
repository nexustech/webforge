import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { HERO_HEIGHT_SITE_DIR } from "./exported-site.js";

// A Whole screen Hero (HH-4) on an exported site, opened from disk: it fills the window under a
// Header with its own band, and the whole window with the Header joined to it. With an Announcement
// bar above the Header, it leaves the bar's room too, and takes it back once the bar is closed or
// past its last day (#1489).

/** Where the bar, the Header and the Hero are on the page, and the window's height. */
const placed = (page: Page) =>
  page.evaluate(() => {
    const bar = document.querySelector<HTMLElement>("[data-wf-announcement]");
    const header = document.querySelector("header.site-header")?.getBoundingClientRect();
    const hero = document.querySelector(".site-hero")?.getBoundingClientRect();
    return {
      barShown: bar !== null && !bar.hidden,
      barBottom: bar?.getBoundingClientRect().bottom ?? Number.NaN,
      headerBottom: header?.bottom ?? Number.NaN,
      heroTop: hero?.top ?? Number.NaN,
      heroBottom: hero?.bottom ?? Number.NaN,
      window: window.innerHeight,
    };
  });

/** Opens the exported page in `folder`. */
const open = (page: Page, folder: string) =>
  page.goto(pathToFileURL(join(HERO_HEIGHT_SITE_DIR, folder, "index.html")).href);

for (const [width, height] of [
  [960, 600],
  [390, 844],
] as const) {
  test(`fills the window under a Header with its own band, at ${width} × ${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await open(page, "own");

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
    await open(page, "joined");

    // From the top of the window to its foot, the Header on it and its room inside the height.
    await expect.poll(async () => (await placed(page)).heroBottom).toBeCloseTo(height, 0);
    const at = await placed(page);
    expect(at.heroTop).toBeCloseTo(0, 0);
    expect(at.headerBottom).toBeLessThan(at.heroBottom);
  });

  for (const [folder, under] of [
    ["own-bar", "the Header's band"],
    ["joined-bar", "a joined Header"],
  ] as const) {
    test(`leaves a bar's room above ${under}, and takes it back once closed, at ${width} × ${height}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await open(page, folder);

      // Below the bar (and the Header's band), to the window's foot.
      await expect.poll(async () => (await placed(page)).heroBottom).toBeCloseTo(height, 0);
      const shown = await placed(page);
      expect(shown.barShown).toBe(true);
      expect(shown.heroTop).toBeCloseTo(
        folder === "own-bar" ? shown.headerBottom : shown.barBottom,
        0,
      );
      expect(shown.heroTop).toBeGreaterThan(folder === "own-bar" ? shown.barBottom : 0);

      // Closed: the Hero starts higher and still reaches the window's foot.
      await page.locator("[data-wf-announcement-close]").click();
      await expect.poll(async () => (await placed(page)).heroTop).toBeLessThan(shown.heroTop);
      const closed = await placed(page);
      expect(closed.barShown).toBe(false);
      expect(closed.heroBottom).toBeCloseTo(height, 0);

      // The next page, with the bar closed already: the same from the start.
      await page.reload();
      await expect.poll(async () => (await placed(page)).heroBottom).toBeCloseTo(height, 0);
      const next = await placed(page);
      expect(next.barShown).toBe(false);
      expect(next.heroTop).toBeCloseTo(closed.heroTop, 0);
    });
  }

  test(`leaves a bar's room with the Header hidden, at ${width} × ${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page, "bar-only");

    await expect.poll(async () => (await placed(page)).heroBottom).toBeCloseTo(height, 0);
    const at = await placed(page);
    expect(at.barShown).toBe(true);
    expect(at.heroTop).toBeCloseTo(at.barBottom, 0);
  });

  test(`takes no room for a bar past its last day, at ${width} × ${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page, "own-past");

    await expect.poll(async () => (await placed(page)).barShown).toBe(false);
    await expect.poll(async () => (await placed(page)).heroBottom).toBeCloseTo(height, 0);
    const at = await placed(page);
    expect(at.heroTop).toBeCloseTo(at.headerBottom, 0);
  });
}

test("keeps its height under a Header that shrinks once scrolled, below a bar", async ({
  page,
}) => {
  // Taller than 600 px: the Shrink style's Header, the bar and the Hero's content need more.
  await page.setViewportSize({ width: 960, height: 800 });
  await open(page, "shrink-bar");

  await expect.poll(async () => (await placed(page)).heroBottom).toBeCloseTo(800, 0);
  const top = await placed(page);
  const tall = top.heroBottom - top.heroTop;
  // Scrolled, the Header shrinks and the page moves up under it; the Hero's height stays.
  await page.mouse.wheel(0, 300);
  await expect
    .poll(() => page.locator("header.site-header").getAttribute("data-scrolled"))
    .toBe("");
  const scrolled = await placed(page);
  expect(scrolled.heroBottom - scrolled.heroTop).toBeCloseTo(tall, 0);
  // Back at the top, as it was once the Header has eased back to its height.
  await page.mouse.wheel(0, -300);
  await expect.poll(async () => (await placed(page)).heroTop).toBeCloseTo(top.heroTop, 0);
  await expect.poll(async () => (await placed(page)).heroBottom).toBeCloseTo(800, 0);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("reaches within a few pixels of the window's foot, under a bar and the Header's band", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 960, height: 600 });
    await open(page, "own-bar");

    // The CSS's estimates of the bar's height and the Header's.
    const at = await placed(page);
    expect(at.barShown).toBe(true);
    expect(Math.abs(at.heroBottom - 600)).toBeLessThanOrEqual(4);
  });
});
