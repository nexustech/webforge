import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { cardRows, expectCardRows } from "../card-rows.js";
import { CARD_ROWS_SITE_DIR } from "./exported-site.js";
import { expect, test } from "./test.js";

// Rows of cards on an exported site, opened from disk, in each browser (#1372, #1511): a row's
// cards the same height, Features' Same height cards alike on every row from 768 px and each as
// tall as its own text on a phone, Fit the text's each its own height, a last row that isn't full
// centred, and Pricing's buttons in line.

for (const width of [1280, 1024, 700, 390]) {
  test(`draws every row of cards as it should at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(pathToFileURL(join(CARD_ROWS_SITE_DIR, "index.html")).href);
    await expect(page.locator(".site-feature").first()).toBeVisible();
    expectCardRows(await cardRows(page), width, "the exported site");
  });
}
