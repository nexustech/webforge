import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { createSite, type PageId } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { launchDesktopApp } from "./launch.js";

// Site-wide confirmations (1.26, D7, F-ED-14): deleting a page says how many pages it changes first,
// and stays one undo step. (Deleting or cutting an element inside the shared Header or Footer asks
// the same way, unit-tested: no component the site library has yet holds elements there.)

let dir: string;
let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "webforge-confirm-"));
  const sitePath = join(dir, "Confirm.wforge");
  const site = createSite({
    name: "Bakery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Not found",
  });
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  // An About page in the menu, so every page links to it.
  const about = "page-about" as PageId;
  site.pages[about] = { ...structuredClone(home), id: about, slug: "about", title: "About" };
  site.pageOrder.splice(1, 0, about);
  site.menu.items.push({ id: "about-item" as never, kind: "page", pageId: about, hidden: false });
  const store = ProjectStore.create(sitePath, { name: "Bakery" });
  store.saveSite(site);
  store.close();
  app = await launchDesktopApp({ args: [sitePath] });
  page = await app.firstWindow();
  await expect(canvas().locator("style[data-webforge-site-css]")).toHaveCount(1);
});

test.afterEach(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const confirmation = () => page.getByRole("alertdialog");
const right = () => page.getByRole("region", { name: "Right panels" });

test("deleting a page says how many pages change, and undo brings it back", async () => {
  await right().getByRole("tab", { name: "Site" }).click();
  await page
    .getByRole("list", { name: "Pages" })
    .getByRole("button", { name: "Actions for About" })
    .click();
  await page.getByRole("menuitem", { name: "Delete…" }).click();

  // About is in the menu every page shows: Home, About and "Not found".
  await expect(confirmation()).toHaveAccessibleName("Delete page 'About'?");
  await expect(confirmation()).toContainText("This changes 3 pages. You can undo it afterwards.");
  await confirmation().getByRole("button", { name: "Delete Page" }).click();
  const about = page.getByRole("list", { name: "Pages" }).getByRole("button", { name: /^About/ });
  await expect(about).toHaveCount(0);

  await page.keyboard.press("ControlOrMeta+z");
  await expect(about).toHaveCount(1);
});
