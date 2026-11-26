import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { JOINED_SITE_DIR } from "./exported-site.js";

// The Header joined to each page's first section (HH-1) on an exported site, opened from disk: on
// the Hero's picture with room under it, solid in the page's colours once scrolled, and its phone
// menu's panel solid; without the script, its CSS still keeps the Hero's title clear of the menu.

const open = (page: Page, file = "index.html") =>
  page.goto(pathToFileURL(join(JOINED_SITE_DIR, file)).href);

/** The Header's and the first section's boxes, the section's title's, and their colours. */
function layout(page: Page) {
  return page.evaluate(() => {
    const header = document.querySelector<HTMLElement>("header.site-header");
    const section = document.querySelector<HTMLElement>("main section");
    const title = section?.querySelector("h1");
    if (!header || !section || !title) throw new Error("No Header, section or title");
    const box = (element: Element) => element.getBoundingClientRect();
    return {
      header: box(header).toJSON() as DOMRect,
      section: box(section).toJSON() as DOMRect,
      title: box(title).toJSON() as DOMRect,
      headerBackground: getComputedStyle(header).backgroundColor,
      headerText: getComputedStyle(header).color,
      sectionText: getComputedStyle(title).color,
      pageBackground: getComputedStyle(document.body).backgroundColor,
      pageText: getComputedStyle(document.body).color,
      measured: document.documentElement.style.getPropertyValue("--wf-header-h"),
    };
  });
}

test("sits on the first section, in its text colour, which makes room for it under the menu", async ({
  page,
}) => {
  for (const file of ["index.html", "about.html"]) {
    await open(page, file);
    const shown = await layout(page);
    // The section starts behind the Header, which has no band of its own.
    expect(Math.round(shown.section.y)).toBe(Math.round(shown.header.y));
    expect(shown.headerBackground).toBe("rgba(0, 0, 0, 0)");
    expect(shown.headerText).toBe(shown.sectionText);
    // The Announcement bar stays a solid band above it (6.4), the section starting below it.
    const bar = page.getByRole("region", { name: "Announcement" });
    const above = await bar.boundingBox();
    expect((above?.y ?? Number.NaN) + (above?.height ?? Number.NaN)).toBeLessThanOrEqual(
      shown.header.y + 1,
    );
    expect(await bar.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(
      "rgba(0, 0, 0, 0)",
    );
    // The script measured the Header, and the section's title is below it.
    expect(shown.measured).toBe(`${Math.round(shown.header.height)}px`);
    expect(shown.title.y).toBeGreaterThan(shown.header.y + shown.header.height);
  }
});

test("turns solid in the page's colours once the page has scrolled, and joined again at the top", async ({
  page,
}) => {
  await open(page);
  const header = page.locator("header.site-header");
  await page.mouse.wheel(0, 400);
  await expect(header).toHaveAttribute("data-scrolled", "");
  // Its colours change with a short transition: read them once it ends.
  await expect
    .poll(async () => {
      const shown = await layout(page);
      return [shown.headerBackground, shown.headerText];
    })
    .toEqual(await layout(page).then((shown) => [shown.pageBackground, shown.pageText]));

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(header).not.toHaveAttribute("data-scrolled", "");
  await expect.poll(async () => (await layout(page)).headerBackground).toBe("rgba(0, 0, 0, 0)");
});

test("on a phone, keeps its menu's button on the section and the opened menu solid", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const menu = page.locator("details[data-wf-menu]");
  const button = menu.locator(":scope > summary");
  const shown = await layout(page);
  expect(await button.evaluate((summary) => getComputedStyle(summary).color)).toBe(
    shown.sectionText,
  );

  await button.click();
  await expect(menu).toHaveAttribute("open", "");
  const panel = menu.locator(":scope > ul");
  expect(await panel.evaluate((list) => getComputedStyle(list).backgroundColor)).toBe(
    shown.pageBackground,
  );
  expect(await panel.evaluate((list) => getComputedStyle(list).color)).toBe(shown.pageText);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("keeps the first section's title clear of the menu with the CSS alone", async ({ page }) => {
    for (const file of ["index.html", "about.html"]) {
      await open(page, file);
      // The CSS's estimate of the Header's height, which the theme's fonts can make a little off.
      const shown = await layout(page);
      expect(Math.abs(shown.section.y - shown.header.y)).toBeLessThan(16);
      expect(shown.title.y).toBeGreaterThan(shown.header.y + shown.header.height);
    }
  });
});
