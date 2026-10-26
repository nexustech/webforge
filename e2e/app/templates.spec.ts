import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, test } from "@playwright/test";
import { expectWorkWithin, measureWork, OPEN_BUDGET, OPEN_WAIT } from "./budget.js";
import { canvasAxe } from "./canvas-axe.js";
import { launchDesktopApp } from "./launch.js";
import { stubFileDialogs } from "./sites.js";
import { TEMPLATES } from "./templates.js";

// The templates of 2.15a and 2.15b, made from New Site (F-SITE-1): each opens, with its photos,
// and its home page passes axe on the canvas, what the editor adds to it included. The opening is
// checked by its CPU time and a loose wall-clock backstop; its 3 s by `pnpm e2e:perf` on a quiet
// machine (ADR 0014).

let dir: string;
let app: ElectronApplication | undefined;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-templates-"));
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

for (const template of TEMPLATES) {
  test(`makes a ${template.title} site within its opening budget, accessible on the canvas (2.15)`, async () => {
    app = await launchDesktopApp({ userDataDir: join(dir, "user-data"), site: false });
    const page = await app.firstWindow();
    await expect(page.getByRole("heading", { name: "Start a site" })).toBeVisible();
    await stubFileDialogs(app, join(dir, "Site.wforge"));

    // Exactly: the title bar's New Site… button has the same name in another case.
    await page.getByRole("button", { name: "New site…", exact: true }).click();
    const newSite = page.getByRole("dialog", { name: "New Site" });
    // The card (its radio is visually hidden, so its label), named with its pages: not the business
    // type's chip of the same name.
    await newSite
      .locator("label")
      .filter({
        has: page.getByRole("radio", { name: new RegExp(`^${template.title}.*pages`) }),
      })
      .click();
    await expect(newSite.getByRole("radio", { name: template.theme })).toBeChecked();

    const opened = await measureWork(app);
    await newSite.getByRole("button", { name: "Create" }).click();
    const canvas = page.frameLocator(".editor__canvas iframe");
    await expect(canvas.locator("h1", { hasText: template.heading })).toBeVisible({
      timeout: OPEN_WAIT,
    });
    expectWorkWithin(await opened(), OPEN_BUDGET, `Opening the ${template.title} site`);
    await expect(canvas.locator("main img, section img").first()).not.toHaveJSProperty(
      "naturalWidth",
      0,
    );

    const results = await canvasAxe(page);
    expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
    expect(results.passes).toBeGreaterThan(5);
  });
}
