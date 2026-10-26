import { expect, test } from "@playwright/test";
import { readTemplates } from "@webforge/templates/node";
import { openPage, withBuiltTemplate } from "./template-site.js";

// Each template's thumbnail (2.14b): its home page as the export draws it, in the template's own
// theme, at desktop width, saved beside the template as `thumbnail.png` (the project's snapshot
// path). Compared in CI's pinned container like the stories' screenshots; `pnpm template-thumbnails`
// writes them again. New Site and the start screen show them. template-pages.spec.ts checks every
// page.

const SCREENSHOTS = process.env.VISUAL_SCREENSHOTS === "1";

for (const folder of readTemplates()) {
  test(`${folder.template.id}'s thumbnail`, async ({ page }) => {
    await withBuiltTemplate(folder, async ({ pages }) => {
      await openPage(page, pages.get("index.html") ?? "");
      if (SCREENSHOTS) {
        await expect(page).toHaveScreenshot([folder.template.id, "thumbnail.png"]);
      }
    });
  });
}
