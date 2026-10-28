import { expect, test } from "@playwright/test";
import { themedPageUrl } from "./exported-site.js";

// The site's own code (F-ED-15, 3.9), in the themed fixture site (export.setup.ts): its stylesheet,
// script and HTML for the head and body of every page, as a browser runs them from disk.

test("runs the site's own stylesheet, script and page HTML from disk (3.9)", async ({ page }) => {
  await page.goto(themedPageUrl("about.html"));

  await expect(page.locator('meta[name="own-head"]')).toHaveAttribute("content", "yes");
  const note = page.locator("#own-note");
  await expect(note).toHaveText("Thanks for visiting");
  const style = await note.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { outline: computed.outlineColor, spacing: computed.letterSpacing };
  });
  // custom.css applies, after the site's stylesheet.
  expect(style.outline).toBe("rgb(255, 0, 0)");
  // A class used only in the site's own code, single-quoted, was compiled.
  expect(style.spacing).not.toBe("normal");
  // custom.js ran, its top-level names global as a classic script's are.
  await expect(page.locator("html")).toHaveAttribute("data-own-script", "ran");
  const greeting = await page.evaluate(
    () => (window as unknown as { ownGreeting?: () => string }).ownGreeting?.() ?? "",
  );
  expect(greeting).toBe("Hello");
});
