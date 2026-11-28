import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { copyWforgeFixture } from "@webforge/test-utils";
import { launchDesktopApp, removeWhenFree, waitForCanvas } from "./launch.js";
import { stubFileDialogs } from "./sites.js";

// A site from an older Webforge (#1525, UC-2): its first change keeps the file as it was, which the
// toast and File › Save the Copy from Before the Update… save as a site file of its own, byte for
// byte, for the older version to open.

let dir: string;
let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "webforge-copy-before-"));
});

test.afterEach(async () => {
  await app?.close();
  void removeWhenFree(dir);
});

test("keeps a site from an older Webforge as it was at its first change, and saves it out (#1525)", async () => {
  // The format 2 fixture: a site saved in an older site format, which this version brings up to
  // date with the first change it saves.
  const sitePath = copyWforgeFixture(2, dir);
  const original = readFileSync(sitePath);
  app = await launchDesktopApp({ args: [sitePath] });
  page = await app.firstWindow();
  await waitForCanvas(page);

  // Opened, not changed: nothing kept, nothing offered.
  const toasts = page.locator("[data-sonner-toast]");
  await expect(toasts.filter({ hasText: "kept a copy" })).toHaveCount(0);

  // A change: a section added, which autosave saves.
  await page
    .getByRole("region", { name: "Left panels" })
    .getByRole("button", { name: "Hero", exact: true })
    .click();
  const kept = toasts.filter({ hasText: /kept a copy of this site as it was/ });
  await expect(kept).toBeVisible({ timeout: 15_000 });

  // Saved out, byte for byte: the site as the older version wrote it.
  const saved = join(dir, "For the older version.wforge");
  await stubFileDialogs(app, saved);
  await kept.getByRole("button", { name: "Save…" }).click();
  await expect(toasts.filter({ hasText: "Saved For the older version.wforge" })).toBeVisible();
  expect(readFileSync(saved).equals(original)).toBe(true);
  // The site itself was brought up to date with the change.
  expect(readFileSync(sitePath).equals(original)).toBe(false);
});
