import { expect, test } from "@playwright/test";
import { EXPORTED_SITE_DIR } from "./exported-site.js";
import { type ServedSite, serveSite } from "./served-site.js";

// The "Page not found" page (F-ED-20, 3.5) of the fixture export (export.setup.ts), served over
// http as a host serves it: at any missing address, folders deep too. Without a web address its
// links and files start at `/`, so it finds its stylesheet, photo and pages wherever it's shown.

let served: ServedSite;

test.beforeAll(async () => {
  served = await serveSite(EXPORTED_SITE_DIR);
});

test.afterAll(async () => {
  await served.close();
});

test("shows the 'Page not found' page at a missing address two folders deep, styled, with its photo and working links (3.5)", async ({
  page,
}) => {
  const missing = `${served.origin}/services/cakes/missing`;
  const failed: string[] = [];
  page.on("requestfailed", (request) => failed.push(request.url()));
  page.on("response", (response) => {
    if (response.status() >= 400 && response.url() !== missing) failed.push(response.url());
  });

  const response = await page.goto(missing);

  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle("Page not found | Rosa's Bakery");
  await page.waitForLoadState("networkidle");
  // The site's stylesheet applies (the body's `flex` is the site's own CSS), and the Hero's photo
  // is loaded.
  expect(await page.evaluate(() => getComputedStyle(document.body).display)).toBe("flex");
  const photo = page.locator("main img").first();
  await expect
    .poll(() => photo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth))
    .toBeGreaterThan(0);
  expect(failed).toEqual([]);

  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "About us" })
    .click();
  await expect(page).toHaveURL(`${served.origin}/about.html`);
});
