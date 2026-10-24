import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { createSite } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { launchDesktopApp, waitForCanvas } from "./launch.js";

// The Gallery on the canvas (2.7a): its images are a repeating list in the Edit panel, laid out in
// the gallery's grid on the canvas as in the export (the slot's class is on Puck's drop zone).

let dir: string;
let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "webforge-gallery-"));
  const sitePath = join(dir, "Gallery.wforge");
  const site = createSite({
    name: "Gallery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Not found",
  });
  site.pages[site.homePageId]?.doc.content.push({
    type: "Gallery",
    props: {
      id: "work",
      title: "Our work",
      images: [{ type: "GalleryImage", props: { id: "g1", caption: "The shop" } }],
    },
  });
  const store = ProjectStore.create(sitePath, { name: "Gallery" });
  store.saveSite(site);
  store.close();
  app = await launchDesktopApp({ args: [sitePath] });
  page = await app.firstWindow();
  await waitForCanvas(page);
});

test.afterEach(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const left = () => page.getByRole("region", { name: "Left panels" });
const panel = () => page.getByRole("region", { name: "Right panels" });
const images = () => canvas().locator(".site-gallery-image");

test("adds images from the Edit panel's list, side by side in the gallery's grid", async () => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await left()
    .getByRole("tree", { name: "Layers" })
    .getByRole("treeitem", { name: /^Gallery/ })
    .click();
  const list = panel().getByRole("group", { name: "Images" });
  await expect(list.getByRole("listitem")).toHaveCount(1);

  await list.getByRole("button", { name: "Add Image" }).click();

  await expect(images()).toHaveCount(2);
  // In the grid's row, as the export lays them out: not one under the other.
  const [first, second] = [
    await images().nth(0).boundingBox(),
    await images().nth(1).boundingBox(),
  ];
  if (first === null || second === null) throw new Error("Images not visible");
  expect(Math.abs(second.y - first.y)).toBeLessThan(2);
  expect(second.x).toBeGreaterThan(first.x + first.width - 1);

  await left().getByRole("tab", { name: "Undo History" }).click();
  await expect(page.locator(".undo-history__step")).toHaveText(["Added Image", "Opened page"]);
});
