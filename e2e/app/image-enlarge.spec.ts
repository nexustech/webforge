import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { createSite, type MediaId } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { heroPhoto } from "@webforge/test-utils";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
import { openPreview } from "./sites.js";

// An Image that opens larger when clicked (3.20): on the canvas a click selects it and opens
// nothing; in Preview it opens the one picture in the lightbox, whole, whatever its shape.

let dir: string;
let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "webforge-image-enlarge-"));
  const sitePath = join(dir, "Enlarge.wforge");
  const site = createSite({
    name: "Enlarge",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Not found",
  });
  site.pages[site.homePageId]?.doc.content.push({
    type: "Section",
    props: {
      id: "photos",
      content: [
        {
          type: "Image",
          props: {
            id: "shop-image",
            image: { mediaId: "shop" },
            width: "medium",
            shape: "portrait",
            caption: "Our shop",
            enlarge: true,
          },
        },
      ],
    },
  });
  const store = ProjectStore.create(sitePath, { name: "Enlarge" });
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
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

const canvas = () => page.frameLocator(".editor__canvas iframe");
const NAME = "Open a larger picture: Our shop front";

test("selects the Image clicked on the canvas, opening nothing and following no link", async () => {
  const before = await canvas()
    .locator("body")
    .evaluate(() => window.location.href);
  const link = canvas().getByRole("link", { name: NAME });

  // Where a person clicks: on the picture, which Puck's overlay covers.
  await link.click({ force: true });
  await link.focus();
  await page.keyboard.press("Enter");

  await expect(canvas().getByRole("dialog")).toHaveCount(0);
  expect(
    await canvas()
      .locator("body")
      .evaluate(() => window.location.href),
  ).toBe(before);
  await expect(
    page
      .getByRole("region", { name: "Left panels" })
      .getByRole("tree", { name: "Layers" })
      .getByRole("treeitem", { name: /^Image/ }),
  ).toHaveAttribute("aria-selected", "true");
});

test("opens the one picture larger in Preview, whole, and gives the focus back on Esc", async () => {
  // The address Preview would open in the default browser, opened here in Chromium instead.
  await app.evaluate(({ shell }) => {
    const opened: string[] = [];
    Object.assign(globalThis, { opened });
    Object.assign(shell, {
      openExternal: async (url: string) => {
        opened.push(url);
      },
    });
  });
  const opened = () =>
    app.evaluate(() => (globalThis as unknown as { opened: string[] }).opened.slice());
  await page.getByRole("banner").getByRole("button", { name: "Preview", exact: true }).click();
  await expect.poll(opened).toHaveLength(1);
  const [url] = await opened();

  const browser = await chromium.launch();
  try {
    const site = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await openPreview(site, url ?? "");
    const link = site.getByRole("link", { name: NAME });
    const viewer = site.getByRole("dialog", { name: "Image viewer" });

    await link.click();

    await expect(viewer).toBeVisible();
    const shown = viewer.getByRole("img", { name: "Our shop front" });
    await expect
      .poll(() => shown.evaluate((img) => (img as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    // The photo's own 16:10, not the Image's Portrait frame.
    const box = await shown.boundingBox();
    if (box === null) throw new Error("The larger picture isn't shown");
    expect(box.width / box.height).toBeCloseTo(1.6, 1);
    await expect(viewer.locator("[data-wf-lightbox-caption]")).toHaveText("Our shop");
    await expect(viewer.getByRole("button", { name: "Next image" })).toHaveCount(0);

    await site.keyboard.press("Escape");
    await expect(viewer).toBeHidden();
    await expect(link).toBeFocused();
  } finally {
    await browser.close();
  }
});
