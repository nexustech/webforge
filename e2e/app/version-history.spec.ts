import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { createSite, type PageId } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { launchDesktopApp, waitForCanvas } from "./launch.js";

// Version History (F-SITE-4, 4.6): Save Version…, the version saved before a confirmed change to
// every page, and Restore as one undo step.

let dir: string;
let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "webforge-versions-"));
  const sitePath = join(dir, "Versions.wforge");
  const site = createSite({
    name: "Bakery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Not found",
  });
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  const about = "page-about" as PageId;
  site.pages[about] = { ...structuredClone(home), id: about, slug: "about", title: "About" };
  site.pageOrder.splice(1, 0, about);
  const store = ProjectStore.create(sitePath, { name: "Bakery" });
  store.saveSite(site);
  store.close();
  app = await launchDesktopApp({ args: [sitePath] });
  page = await app.firstWindow();
  await waitForCanvas(page);
});

test.afterEach(async () => {
  await app.close();
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

const left = () => page.getByRole("region", { name: "Left panels" });
const right = () => page.getByRole("region", { name: "Right panels" });
const versions = () => page.getByRole("list", { name: "Versions" });
const aboutPage = () =>
  page.getByRole("list", { name: "Pages" }).getByRole("button", { name: /^About/ });

test("a version saved before a page is deleted brings it back, as one undo step", async () => {
  // The person's own version, by its name.
  await page.keyboard.press("ControlOrMeta+Alt+s");
  const naming = page.getByRole("dialog", { name: "Save Version" });
  await naming.getByLabel("Version name").fill("Before the change");
  await naming.getByRole("button", { name: "Save Version" }).click();
  await expect(naming).toHaveCount(0);

  // A page deleted once the person agrees: a version is saved first.
  await right().getByRole("tab", { name: "Site" }).click();
  await page
    .getByRole("list", { name: "Pages" })
    .getByRole("button", { name: "Actions for About" })
    .click();
  await page.getByRole("menuitem", { name: "Delete…" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete Page" }).click();
  await expect(aboutPage()).toHaveCount(0);

  // Newest first; the day's first saved change took the daily version too, in between.
  await left().getByRole("tab", { name: "Version History" }).click();
  await expect(versions().getByRole("listitem").first()).toContainText("Before: Delete Page");
  await expect(versions().getByRole("listitem").last()).toContainText("Before the change");

  await versions().getByRole("button", { name: "More for “Before: Delete Page”" }).click();
  await page.getByRole("menuitem", { name: "Restore…" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Restore Version" }).click();
  await expect(aboutPage()).toHaveCount(1);
  // The site as it was before the restore is a version too.
  await expect(versions().getByRole("listitem").first()).toContainText("Before a restore");

  await left().getByRole("tab", { name: "Undo History" }).click();
  await expect(page.locator(".undo-history__step").first()).toHaveText(
    "Restored version “Before: Delete Page”",
  );
  await page.locator(".editor__canvas").focus();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(aboutPage()).toHaveCount(0);
});

test("Clean Up gives free space back, and Undo still brings back what it changed (P3)", async () => {
  await right().getByRole("tab", { name: "Site" }).click();
  await page
    .getByRole("list", { name: "Pages" })
    .getByRole("button", { name: "Actions for About" })
    .click();
  await page.getByRole("menuitem", { name: "Delete…" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete Page" }).click();
  await expect(aboutPage()).toHaveCount(0);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);

  await left().getByRole("tab", { name: "Version History" }).click();
  await left().getByRole("button", { name: "Clean Up" }).click();
  await expect(page.getByText(/^Cleaned up: /)).toBeVisible();

  await page.locator(".editor__canvas").focus();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(aboutPage()).toHaveCount(1);
});
