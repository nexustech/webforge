import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { HIDING_HEADER_SITE_DIR } from "./exported-site.js";

// A Header that hides on the way down (HH-7) on an exported site, opened from disk: out of view as
// the visitor scrolls down, back as they scroll up, at once for a visitor who asks for less motion,
// and simply sticky without the script.

const url = (page: string, anchor = "") =>
  `${pathToFileURL(join(HIDING_HEADER_SITE_DIR, page)).href}${anchor}`;
const header = (page: Page) => page.locator("header.site-header");

/** Where the Header's bottom edge is now: 0 or less once it has slid out of view. */
const bottom = (page: Page) =>
  header(page).evaluate((element) => element.getBoundingClientRect().bottom);

/**
 * Scrolls by `by` pixels with the mouse wheel, as a visitor does, down or (negative) up, and waits
 * for the scroll to end: macOS animates it. It has ended once the page has moved that way and two
 * reads in a row agree.
 */
async function wheel(page: Page, by: number): Promise<void> {
  const scrollY = () => page.evaluate(() => window.scrollY);
  const start = await scrollY();
  await page.mouse.move(200, 300);
  await page.mouse.wheel(0, by);
  let last = Number.NaN;
  await expect
    .poll(async () => {
      const now = await scrollY();
      const ended = Math.sign(now - start) === Math.sign(by) && now === last;
      last = now;
      return ended;
    })
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
});

test("hides on the way down, and comes back on the way up and at the top", async ({ page }) => {
  await page.goto(url("index.html"));
  await expect(header(page)).not.toHaveAttribute("data-hidden");

  await wheel(page, 500);
  await expect(header(page)).toHaveAttribute("data-hidden", "");
  await expect.poll(() => bottom(page)).toBeLessThanOrEqual(0);

  await wheel(page, -200);
  await expect(header(page)).not.toHaveAttribute("data-hidden");
  await expect
    .poll(() => header(page).evaluate((element) => element.getBoundingClientRect().top))
    .toBe(0);

  await wheel(page, 300);
  await expect(header(page)).toHaveAttribute("data-hidden", "");
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(header(page)).not.toHaveAttribute("data-hidden");
});

test.describe("for a visitor who asks for less motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("goes and comes back without sliding", async ({ page }) => {
    await page.goto(url("index.html"));
    expect(
      await header(page).evaluate((element) => getComputedStyle(element).transitionProperty),
    ).toBe("none");

    await wheel(page, 500);
    await expect(header(page)).toHaveAttribute("data-hidden", "");
    // Out of view at once, with nothing in between.
    expect(await bottom(page)).toBeLessThanOrEqual(0);
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("stays at the top, as a sticky Header does", async ({ page }) => {
    await page.goto(url("index.html"));
    await wheel(page, 500);
    await expect(header(page)).not.toHaveAttribute("data-hidden");
    expect(await header(page).evaluate((element) => element.getBoundingClientRect().top)).toBe(0);
  });
});

test("stays in view while the phone menu is open", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto(url("index.html"));
  const menu = header(page).locator("details.site-menu");
  await menu.locator(":scope > summary").click();
  await expect(menu).toHaveAttribute("open", "");

  await wheel(page, 400);
  await expect(header(page)).not.toHaveAttribute("data-hidden");
  expect(await header(page).evaluate((element) => element.getBoundingClientRect().top)).toBe(0);
});

test("keeps an anchor's section in view, not under the Header", async ({ page }) => {
  await page.goto(url("index.html", "#questions"));
  const target = page.locator("#questions");
  await expect(target).toBeInViewport();
  // Below the Header where it shows, and in view where it has slid away.
  await expect
    .poll(async () => ((await target.boundingBox())?.y ?? -1) - Math.max(0, await bottom(page)))
    .toBeGreaterThanOrEqual(-1);
});
