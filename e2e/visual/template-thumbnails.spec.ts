import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { siteToSnapshot } from "@webforge/model";
import { buildSite } from "@webforge/pipeline";
import { loadNodeResources } from "@webforge/pipeline/node";
import { siteLibrary } from "@webforge/site-components";
import { siteFromTemplate } from "@webforge/templates";
import { readTemplates } from "@webforge/templates/node";
import { themePreset } from "@webforge/themes";

// Each template's thumbnail (2.14b): its home page as the export draws it, in the template's own
// theme, at desktop width, saved beside the template as `thumbnail.png` (the project's snapshot
// path). Compared in CI's pinned container like the stories' screenshots; `pnpm template-thumbnails`
// writes them again. New Site and the start screen show them. Every page of the template is checked
// with axe too (2.15), as the stories are: a site made from it starts accessible.

const SCREENSHOTS = process.env.VISUAL_SCREENSHOTS === "1";

for (const { template, images, imagesDir } of readTemplates()) {
  test(`${template.id}'s thumbnail, and every page axe-clean`, async ({ page }) => {
    const theme = themePreset(template.site.theme.preset) ?? template.site.theme;
    const site = siteFromTemplate(template, images, {
      name: template.site.settings.general.name,
      theme,
    });
    const blobs = new Map(
      images.map((image) => [
        image.hash,
        new Uint8Array(readFileSync(join(imagesDir, image.file))),
      ]),
    );
    const built = await buildSite(
      siteToSnapshot(site, blobs),
      siteLibrary,
      await loadNodeResources(),
    );
    const dir = mkdtempSync(join(tmpdir(), "webforge-thumbnail-"));
    try {
      for (const [path, bytes] of built.files) {
        mkdirSync(dirname(join(dir, path)), { recursive: true });
        writeFileSync(join(dir, path), bytes);
      }
      await page.goto(pathToFileURL(join(dir, "index.html")).href);
      await page.evaluate(() => document.fonts.ready);
      // Every photo in, so the thumbnail never shows one half loaded.
      await expect
        .poll(() => page.evaluate(() => [...document.images].every((image) => image.complete)))
        .toBe(true);
      if (SCREENSHOTS) {
        await expect(page).toHaveScreenshot([template.id, "thumbnail.png"]);
      }
      for (const path of [...built.files.keys()].filter((each) => each.endsWith(".html"))) {
        await page.goto(pathToFileURL(join(dir, path)).href);
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        expect(
          results.violations.map((violation) => `${violation.id}: ${violation.help}`),
          `${template.id} ${path}`,
        ).toEqual([]);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
