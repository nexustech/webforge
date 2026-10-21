import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { createSite, type MediaId } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { heroPhoto } from "@webforge/test-utils";
import { launchDesktopApp } from "./launch.js";
import { stubFileDialogs } from "./sites.js";

// Media import (1.16): files go into the site file unmodified, and the editor shows them through
// the webforge-media: scheme, as thumbnails made in a worker.

type ImportedItem = { kind: string; hash: string; name: string; width?: number };
type MediaWindow = {
  webforge: {
    media: {
      import(files: { fileName: string; data: Uint8Array }[]): Promise<{
        status: string;
        items?: ImportedItem[];
        rejected?: { fileName: string; reason: string }[];
      }>;
      choose(): Promise<{ status: string; items?: ImportedItem[] }>;
    };
  };
};

let dir: string;
let sitePath: string;
let app: ElectronApplication | undefined;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-media-"));
  sitePath = join(dir, "Media.wforge");
  ProjectStore.create(sitePath, { name: "Media" }).close();
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

/** The running app; tests call it once they have launched one. */
function running(): ElectronApplication {
  if (app === undefined) throw new Error("The app is not running");
  return app;
}

async function openSite(): Promise<Page> {
  const launched = await launchDesktopApp({ args: [sitePath] });
  app = launched;
  const page = await launched.firstWindow();
  await page.waitForFunction(() => "webforge" in window);
  return page;
}

/** Loads `src` in an `<img>` in the editor window and returns its size, or null if it failed. */
const imageSize = (page: Page, src: string) =>
  page.evaluate(
    (url) =>
      new Promise<{ width: number; height: number } | null>((resolve) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => resolve(null);
        image.src = url;
      }),
    src,
  );

test("imports a dropped photo unmodified and shows its thumbnail and original", async () => {
  const page = await openSite();
  const photo = heroPhoto();

  const result = await page.evaluate(
    (bytes) =>
      (window as unknown as MediaWindow).webforge.media.import([
        { fileName: "Shop front.jpg", data: new Uint8Array(bytes) },
        { fileName: "notes.txt", data: new TextEncoder().encode("hello") },
      ]),
    [...photo],
  );

  expect(result).toMatchObject({
    status: "imported",
    items: [{ kind: "image", name: "shop-front", width: 1600 }],
    rejected: [{ fileName: "notes.txt", reason: "unsupported" }],
  });
  const hash = result.items?.[0]?.hash ?? "";
  // Through the scheme, inside the editor's Content Security Policy.
  expect(await imageSize(page, `webforge-media://thumbnail/${hash}`)).toEqual({
    width: 320,
    height: 200,
  });
  expect(await imageSize(page, `webforge-media://original/${hash}`)).toEqual({
    width: 1600,
    height: 1000,
  });
  expect(await imageSize(page, `webforge-media://original/${"0".repeat(64)}`)).toBeNull();

  await app?.close();
  app = undefined;
  const store = ProjectStore.open(sitePath, { readOnly: true });
  try {
    expect(new Uint8Array(store.readBlob(hash)?.data ?? [])).toEqual(photo);
  } finally {
    store.close();
  }
});

test("imports files chosen in the dialog", async () => {
  const page = await openSite();
  const prices = join(dir, "Prices.pdf");
  writeFileSync(prices, "%PDF-1.7\nprices");
  await stubFileDialogs(running(), prices);

  const result = await page.evaluate(() =>
    (window as unknown as MediaWindow).webforge.media.choose(),
  );

  expect(result).toMatchObject({ status: "imported", items: [{ kind: "file", name: "prices" }] });
});

test("adds a photo in the Media panel, describes and crops it, and keeps it in the site", async () => {
  const page = await openSite();
  const photoPath = join(dir, "Shop front.jpg");
  writeFileSync(photoPath, heroPhoto());
  await stubFileDialogs(running(), photoPath);
  await expect(page.getByRole("banner").getByRole("status")).toHaveText("Saved", {
    timeout: 30_000,
  });

  await page.getByRole("tab", { name: "Media" }).click();
  const panel = page.getByRole("region", { name: "Media" });
  await panel.getByRole("button", { name: "Add images or files…" }).click();

  const item = panel.getByRole("button", { name: "Shop front.jpg" });
  await expect(item).toHaveAttribute("aria-pressed", "true");
  // The thumbnail comes through the webforge-media: scheme.
  await expect
    .poll(() => item.locator("img").evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBe(320);

  const alt = panel.getByRole("textbox", { name: "Alt text" });
  await alt.fill("Our shop front on a sunny morning");
  await alt.blur();
  await panel.getByRole("radio", { name: "Square" }).click();
  await expect(page.getByRole("banner").getByRole("status")).toHaveText("Saved", {
    timeout: 10_000,
  });

  // Delete offers Undo; the image comes back with its alt text.
  await panel.getByRole("button", { name: "Delete" }).click();
  await expect(item).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).last().click();
  await expect(item).toBeVisible();
  await item.click();
  await expect(alt).toHaveValue("Our shop front on a sunny morning");

  await app?.close();
  app = undefined;
  const store = ProjectStore.open(sitePath, { readOnly: true });
  try {
    const media = Object.values(store.readSite().media);
    expect(media).toEqual([
      expect.objectContaining({
        name: "shop-front",
        fileName: "Shop front.jpg",
        alt: "Our shop front on a sunny morning",
        crop: { x: 0.1875, y: 0, width: 0.625, height: 1 },
      }),
    ]);
  } finally {
    store.close();
  }
});

test("exports a placed photo cut to its crop, as WebP with a JPEG fallback and its alt text", async () => {
  // A site whose Hero shows a cropped photo with alt text, as the Media panel and Edit panel leave it.
  const photo = heroPhoto();
  const store = ProjectStore.open(sitePath);
  try {
    const { hash } = store.putAsset({
      mediaId: "shop",
      data: photo,
      mime: "image/jpeg",
      width: 1600,
      height: 1000,
      originalName: "Shop front.jpg",
    });
    const site = createSite({
      name: "Media",
      language: "en-GB",
      homeTitle: "Home",
      notFoundTitle: "Page not found",
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
        focal: { x: 0.5, y: 0.4 },
        crop: { x: 0.1875, y: 0, width: 0.625, height: 1 },
      },
    };
    const home = site.pages[site.homePageId];
    if (home === undefined) throw new Error("no home page");
    home.doc.content = [
      { type: "Hero", props: { id: "hero", title: "Fresh bread", image: { mediaId: "shop" } } },
    ];
    store.saveSite(site);
  } finally {
    store.close();
  }

  const page = await openSite();
  const folder = join(dir, "exported");
  await stubFileDialogs(running(), folder);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(page.getByText(/Site exported to “exported”/)).toBeVisible({ timeout: 60_000 });

  // Cut to the square crop (1000 × 1000), so exported at 640 and 1000 wide.
  expect(readdirSync(join(folder, "assets", "img")).sort()).toEqual([
    "shop-front-1000.jpg",
    "shop-front-1000.webp",
    "shop-front-640.jpg",
    "shop-front-640.webp",
  ]);
  const index = readFileSync(join(folder, "index.html"), "utf8");
  expect(index).toContain('type="image/webp" srcSet="assets/img/shop-front-640.webp 640w');
  expect(index).toContain('src="assets/img/shop-front-1000.jpg"');
  expect(index).toContain('width="1000" height="1000" alt="Our shop front"');
  expect(index).toContain('style="object-position:50% 40%"');
});
