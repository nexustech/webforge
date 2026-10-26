import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, test } from "@playwright/test";
import { canvasAxe } from "./canvas-axe.js";
import { launchDesktopApp } from "./launch.js";
import { stubFileDialogs } from "./sites.js";

// The templates of 2.15b, made from New Site (F-SITE-1): each opens in under 3 s, with its photos,
// and its home page passes axe on the canvas, what the editor adds to it included.

/** Each template: its card's title, the theme it brings, and its home page's heading. */
const TEMPLATES = [
  { title: "Consultant", theme: "Meridian", heading: "Clear advice for growing businesses" },
  { title: "Photographer / Portfolio", theme: "Darkroom", heading: "Light, land and people" },
  { title: "Shop", theme: "Market", heading: "Handmade pots for happy plants" },
] as const;

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
  test(`makes a ${template.title} site in under 3 s, accessible on the canvas (2.15b)`, async () => {
    app = await launchDesktopApp({ userDataDir: join(dir, "user-data"), site: false });
    const page = await app.firstWindow();
    await expect(page.getByRole("heading", { name: "Start a site" })).toBeVisible();
    await stubFileDialogs(app, join(dir, "Site.wforge"));

    // Exactly: the title bar's New Site… button has the same name in another case.
    await page.getByRole("button", { name: "New site…", exact: true }).click();
    const newSite = page.getByRole("dialog", { name: "New Site" });
    // The card, named with its pages, not the business type's chip of the same name.
    await newSite.getByRole("radio", { name: new RegExp(`^${template.title}.*pages`) }).click();
    await expect(newSite.getByRole("radio", { name: template.theme })).toBeChecked();

    const started = Date.now();
    await newSite.getByRole("button", { name: "Create" }).click();
    const canvas = page.frameLocator(".editor__canvas iframe");
    await expect(canvas.locator("h1", { hasText: template.heading })).toBeVisible();
    expect(Date.now() - started).toBeLessThan(3_000);
    await expect(canvas.locator("main img, section img").first()).not.toHaveJSProperty(
      "naturalWidth",
      0,
    );

    const results = await canvasAxe(page);
    expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
    expect(results.passes).toBeGreaterThan(5);
  });
}
