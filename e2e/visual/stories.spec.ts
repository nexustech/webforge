import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { z } from "zod";

// Every story of the editor UI in both themes: no serious or critical axe violations, and (in CI's
// Linux container) a screenshot that matches the committed one.

const indexSchema = z.object({
  entries: z.record(
    z.string(),
    z.object({ id: z.string(), title: z.string(), name: z.string(), type: z.string() }),
  ),
});

const INDEX = resolve(import.meta.dirname, "../../packages/editor-ui/storybook-static/index.json");
const stories = Object.values(indexSchema.parse(JSON.parse(readFileSync(INDEX, "utf8"))).entries)
  .filter((entry) => entry.type === "story")
  .toSorted((a, b) => a.id.localeCompare(b.id));

const THEMES = ["dark", "light"] as const;
const SCREENSHOTS = process.env.VISUAL_SCREENSHOTS === "1";

test("finds the stories", () => {
  expect(stories.length).toBeGreaterThan(0);
});

for (const story of stories) {
  for (const theme of THEMES) {
    test(`${story.title} › ${story.name} (${theme})`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.goto(`/iframe.html?id=${story.id}&viewMode=story&globals=theme:${theme}`);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      // Storybook marks the body once the story has rendered (dialogs render outside the root).
      await expect(page.locator("body.sb-show-main")).toBeAttached();
      await page.evaluate(() => document.fonts.ready);

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const serious = results.violations
        .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
        .map(
          (violation) =>
            `${violation.id}: ${violation.nodes.map((node) => node.target).join(", ")}`,
        );
      expect(serious).toEqual([]);
      expect(errors).toEqual([]);

      if (SCREENSHOTS) {
        await expect(page).toHaveScreenshot(`${story.id}--${theme}.png`, { fullPage: true });
      }
    });
  }
}
