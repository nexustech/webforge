import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
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
