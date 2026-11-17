import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { CONTACT_BUTTONS_SITE_DIR } from "./exported-site.js";

// Contact buttons (6.16d) on an exported site, opened from disk: they stay at the bottom left of
// the screen, and the end of the page scrolls clear of them, so they never cover the Footer.

const buttons = (page: Page) => page.getByRole("navigation", { name: "Contact us" });

/** Opens `file` on a phone's screen. */
async function open(page: Page, file: string): Promise<void> {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(pathToFileURL(join(CONTACT_BUTTONS_SITE_DIR, file)).href);
}

/** Answers the cookie banner, which covers the buttons until the visitor chooses. */
const decline = (page: Page) =>
  page.getByRole("region", { name: "Cookies" }).getByRole("button", { name: "Decline" }).click();

test("stays at the bottom left of the screen as the page scrolls", async ({ page }) => {
  await open(page, "index.html");
  await decline(page);
  await expect(buttons(page).getByRole("link")).toHaveCount(2);
  const before = await buttons(page).boundingBox();
  await page.evaluate(() => window.scrollTo(0, window.innerHeight));
  const after = await buttons(page).boundingBox();

  expect(after).toEqual(before);
  expect(before?.x).toBe(16);
  expect((before?.y ?? 0) + (before?.height ?? 0)).toBe(667 - 16);
});

test("leaves the Footer's links clear at the end of the page, on a phone (#539)", async ({
  page,
}) => {
  for (const file of ["index.html", "about.html"]) {
    await open(page, file);
    // The choice is kept for the rest of the visit: the banner asks on the first page only.
    if (file === "index.html") await decline(page);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    // Cookie settings, which reopens the banner, is shown once the banner has been answered.
    const footer = page.locator("footer.site-footer");
    await expect(footer.getByRole("button", { name: "Cookie settings" })).toBeVisible();

    // Each of its links and buttons, down to its last at the bottom left, is what's at its centre:
    // none is under the buttons.
    const covered = await footer.evaluate((element) =>
      [...element.querySelectorAll<HTMLElement>("a, button")]
        .filter((link) => link.checkVisibility())
        .filter((link) => {
          const box = link.getBoundingClientRect();
          const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
          return hit === null || !link.contains(hit);
        })
        .map((link) => link.textContent?.trim()),
    );
    expect(covered, file).toEqual([]);
    expect(await footer.locator("a, button").count(), file).toBeGreaterThan(2);
  }
});
