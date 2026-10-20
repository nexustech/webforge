import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { z } from "zod";

// Every story of the editor UI in both themes: no serious or critical axe violations, and (in CI's
// Linux container) a screenshot that matches the committed one.

const indexSchema = z.object({
  entries: z.record(
    z.string(),
    z.object({
      id: z.string(),
      title: z.string(),
      name: z.string(),
      type: z.string(),
      tags: z.array(z.string()).default([]),
    }),
  ),
});

const INDEX = resolve(import.meta.dirname, "../../packages/editor-ui/storybook-static/index.json");
if (!existsSync(INDEX)) {
  throw new Error(`No Storybook build at ${INDEX}. Run \`pnpm visual\` from the repository root.`);
}
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

      // Whole-window stories (the UI1 parity story) get a window-sized page.
      if (story.tags.includes("full-window")) {
        await page.setViewportSize({ width: 1280, height: 800 });
      }
      await page.goto(`/iframe.html?id=${story.id}&viewMode=story&globals=theme:${theme}`);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      // Wait until Storybook has rendered the story and run its play function (the ContextMenu
      // story opens its menu there); dialogs render outside #storybook-root, so don't look there.
      await page.waitForFunction(
        () =>
          (window as { __STORYBOOK_PREVIEW__?: { currentRender?: { phase?: string } } })
            .__STORYBOOK_PREVIEW__?.currentRender?.phase === "finished",
      );
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
