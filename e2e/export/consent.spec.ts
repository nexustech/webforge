import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { themedPageUrl } from "./exported-site.js";

// Google Analytics' consent banner (3.8, B4, B7) on the themed export (export.setup.ts), opened
// from disk with the network blocked: the banner asks, nothing reaches Google before or after
// (a page from disk is never counted), and Accept all loads the page's video.

let requests: string[] = [];

test.beforeEach(async ({ context }) => {
  requests = [];
  await context.route(/^(?!file:)/, async (route) => {
    requests.push(route.request().url());
    await route.abort();
  });
});

test("asks before counting, never counts from disk, and Accept all loads the embeds (3.8)", async ({
  page,
}) => {
  await page.goto(themedPageUrl("about.html"));
  const banner = page.getByRole("region", { name: "Cookies" });

  await expect(banner).toBeVisible();
  await expect(banner).toContainText("We'd like to use cookies to count visits");
  // In the theme's colours, readable and reachable (axe).
  const results = await new AxeBuilder({ page }).include("[data-wf-consent]").analyze();
  expect(results.violations).toEqual([]);
  await expect(page.locator("iframe")).toHaveCount(0);
  expect(requests).toEqual([]);

  await banner.getByRole("button", { name: "Accept all" }).click();

  await expect(banner).toBeHidden();
  // The video loads, though the visitor never pressed its own button.
  await expect(page.locator(".site-video iframe")).toHaveAttribute(
    "src",
    "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ",
  );
  // Opened from disk, Google's script never loads, even with consent.
  await expect(page.locator('script[src*="googletagmanager"]')).toHaveCount(0);
  expect(
    requests.filter((url) => url.includes("google-analytics") || url.includes("googletagmanager")),
  ).toEqual([]);
});

test("Decline hides the banner and loads nothing (3.8)", async ({ page }) => {
  await page.goto(themedPageUrl("about.html"));
  const banner = page.getByRole("region", { name: "Cookies" });

  await banner.getByRole("button", { name: "Decline" }).click();

  await expect(banner).toBeHidden();
  await expect(page.locator("iframe")).toHaveCount(0);
  expect(requests).toEqual([]);
});
