import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { ANNOUNCEMENT_SITE_DIR } from "./exported-site.js";
import { serveSite } from "./served-site.js";

// The Announcement bar (6.4) on an exported site: above the Header on every page, closed by
// keyboard for the rest of the visit, and gone after its last day.

const bar = (page: Page) => page.getByRole("region", { name: "Announcement" });
const close = (page: Page) => page.getByRole("button", { name: "Close the announcement" });

test("shows above the Header on every page, opened from disk", async ({ page }) => {
  for (const file of ["index.html", "about.html"]) {
    await page.goto(pathToFileURL(join(ANNOUNCEMENT_SITE_DIR, file)).href);
    await expect(bar(page)).toBeVisible();
    await expect(bar(page)).toContainText("Closed 24–26 December");
    const above = await bar(page).boundingBox();
    const header = await page.locator("header.site-header").boundingBox();
    expect(above?.y ?? Number.NaN).toBeLessThan(header?.y ?? Number.NaN);
  }
});

test("closes by keyboard, and stays closed on the next page of the visit", async ({ page }) => {
  const site = await serveSite(ANNOUNCEMENT_SITE_DIR);
  try {
    await page.goto(`${site.origin}/index.html`);
    await close(page).focus();
    await page.keyboard.press("Enter");

    await expect(bar(page)).toBeHidden();
    // The next Tab starts from the top of the page that's left.
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);

    await page.goto(`${site.origin}/about.html`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(bar(page)).toBeHidden();
  } finally {
    await site.close();
  }
});

test("isn't shown after its last day", async ({ page }) => {
  await page.clock.setFixedTime(new Date(2100, 0, 1, 9, 0));
  await page.goto(pathToFileURL(join(ANNOUNCEMENT_SITE_DIR, "index.html")).href);

  await expect(page.locator("header.site-header")).toBeVisible();
  await expect(bar(page)).toBeHidden();
});
