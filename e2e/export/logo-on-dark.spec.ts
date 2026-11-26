import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { LOGO_ON_DARK_SITE_DIR } from "./exported-site.js";

// Site Settings' logo for dark backgrounds (HH-2) on an exported site, opened from disk: the Header
// joined to a Hero's picture under a dark overlay shows it, and swaps it for the logo as it turns
// solid in the page's light colours once scrolled; on a light section, only the logo. Each picture
// has WebP with a fallback.

const open = (page: Page, file = "index.html") =>
  page.goto(pathToFileURL(join(LOGO_ON_DARK_SITE_DIR, file)).href);

/** The Header's logos: each one's file, whether it shows, and what it says. */
function logos(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("header.site-header picture")].map((picture) => {
      const img = picture.querySelector("img");
      const file = (img?.getAttribute("src") ?? "").split("/").pop() ?? "";
      return {
        light: file.startsWith("logo-light"),
        shown: img !== null && img.getBoundingClientRect().width > 0,
        alt: img?.getAttribute("alt") ?? null,
        webp: picture.querySelector('source[type="image/webp"]') !== null,
      };
    }),
  );
}

/** Which logo shows: the light one, the logo, or none. */
async function shown(page: Page): Promise<"light" | "logo" | "none"> {
  const visible = (await logos(page)).filter((logo) => logo.shown);
  if (visible.length !== 1) return "none";
  return visible[0]?.light === true ? "light" : "logo";
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
});

test("shows the light logo on the dark picture, and the logo once the Header turns solid", async ({
  page,
}) => {
  await open(page);
  const both = await logos(page);
  expect(both.map(({ light, webp, alt }) => ({ light, webp, alt }))).toEqual([
    { light: true, webp: true, alt: "Rosa's Bakery" },
    { light: false, webp: true, alt: "Rosa's Bakery" },
  ]);
  expect(await shown(page)).toBe("light");

  await page.evaluate(() => window.scrollTo(0, 400));
  const header = page.locator("header.site-header");
  await expect(header).toHaveAttribute("data-scrolled", "");
  await expect.poll(() => shown(page)).toBe("logo");

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(header).not.toHaveAttribute("data-scrolled", "");
  await expect.poll(() => shown(page)).toBe("light");
});

test("shows only the logo on a light section", async ({ page }) => {
  await open(page, "about.html");
  expect(await logos(page)).toEqual([
    { light: false, shown: true, alt: "Rosa's Bakery", webp: true },
  ]);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("keeps the light logo on the picture, as the Header scrolls away with it", async ({
    page,
  }) => {
    await open(page);
    expect(await shown(page)).toBe("light");
  });
});
