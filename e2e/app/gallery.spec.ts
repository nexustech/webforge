import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { createSite, type MediaId } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { heroPhoto } from "@webforge/test-utils";
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
      images: [
        {
          type: "GalleryImage",
          props: { id: "g1", image: { mediaId: "shop" }, caption: "The shop" },
        },
      ],
    },
  });
  const store = ProjectStore.create(sitePath, { name: "Gallery" });
  const { hash } = store.putAsset({
    mediaId: "shop",
    data: heroPhoto(),
    mime: "image/jpeg",
    width: 1600,
    height: 1000,
    originalName: "Shop front.jpg",
  });
  site.media = {
    ["shop" as MediaId]: {
      id: "shop" as MediaId,
      hash,
      name: "shop-front",
      fileName: "Shop front.jpg",
      kind: "image",
      mimeType: "image/jpeg",
      width: 1600,
      height: 1000,
      alt: "Our shop front",
    },
  };
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

test("selects an image clicked on the canvas, without following its link to the file", async () => {
  const before = await canvas()
    .locator("body")
    .evaluate(() => window.location.href);

  const link = canvas().getByRole("link", { name: "Open larger: Our shop front" });
  // Where a person clicks: on the image, which Puck's overlay covers.
  await link.click({ force: true });
  await expect(images()).toHaveCount(1);
  await link.focus();
  await page.keyboard.press("Enter");

  await expect(images()).toHaveCount(1);
  expect(
    await canvas()
      .locator("body")
      .evaluate(() => window.location.href),
  ).toBe(before);
  await expect(
    left()
      .getByRole("tree", { name: "Layers" })
      .getByRole("treeitem", { name: /^Image/ }),
  ).toHaveAttribute("aria-selected", "true");
});
