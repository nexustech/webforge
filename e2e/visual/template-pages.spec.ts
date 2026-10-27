import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { readTemplates } from "@webforge/templates/node";
import { openPage, withBuiltTemplate } from "./template-site.js";

// Every page of every template (2.15, 2.16; MVP §6, Phase 2's exit: all templates pass axe and
// visual regression), as the export draws it in the template's own theme, on Desktop and Mobile:
// no axe violations (WCAG 2.1 A/AA), and (in CI's Linux container) a full-page screenshot that
// matches the committed one. `pnpm visual:docker` writes them.

const SCREENSHOTS = process.env.VISUAL_SCREENSHOTS === "1";

/** The device widths, as the stories' (the canvas toolbar's, 1.15). */
const DEVICES = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 375, height: 812 },
] as const;

for (const folder of readTemplates()) {
  for (const device of DEVICES) {
    test(`${folder.template.id}'s pages (${device.name})`, async ({ page }) => {
      await page.setViewportSize({ width: device.width, height: device.height });
      await withBuiltTemplate(folder, async ({ pages }) => {
        for (const [path, address] of pages) {
          await openPage(page, address, { wholePage: true });
          const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
            .analyze();
          expect(
            results.violations.map((violation) => `${violation.id}: ${violation.help}`),
            `${folder.template.id} ${path}`,
          ).toEqual([]);
          if (SCREENSHOTS) {
            const name = `template-${folder.template.id}--${path.replace(/\.html$/, "").replaceAll("/", "-")}--${device.name}.png`;
            await expect(page, `${folder.template.id} ${path}`).toHaveScreenshot(name, {
              fullPage: true,
            });
          }
        }
      });
    });
  }
}
