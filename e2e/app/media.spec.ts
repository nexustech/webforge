import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { createSite, type MediaId } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { heroPhoto, minimalDocx } from "@webforge/test-utils";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
import { exportFromEditor, stubFileDialogs } from "./sites.js";

// Media import (1.16): files go into the site file unmodified, and the editor shows them through
// the webforge-media: scheme, as thumbnails made in a worker.

type ImportedItem = { kind: string; hash: string; name: string; width?: number };
type MediaWindow = {
  webforge: {
    project: { getCurrent(): Promise<{ sessionId: string } | null> };
    media: {
      import(
        sessionId: string,
        files: { fileName: string; data: Uint8Array }[],
      ): Promise<{
        status: string;
        items?: ImportedItem[];
        rejected?: { fileName: string; reason: string }[];
      }>;
      choose(sessionId: string): Promise<{ status: string; items?: ImportedItem[] }>;
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
    async (bytes) => {
      const { project, media } = (window as unknown as MediaWindow).webforge;
      return media.import((await project.getCurrent())?.sessionId ?? "", [
        { fileName: "Shop front.jpg", data: new Uint8Array(bytes) },
        { fileName: "notes.html", data: new TextEncoder().encode("<p>hello</p>") },
      ]);
    },
    [...photo],
  );

  expect(result).toMatchObject({
    status: "imported",
    items: [{ kind: "image", name: "shop-front", width: 1600 }],
    rejected: [{ fileName: "notes.html", reason: "unsupported" }],
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

  const result = await page.evaluate(async () => {
    const { project, media } = (window as unknown as MediaWindow).webforge;
    return media.choose((await project.getCurrent())?.sessionId ?? "");
  });

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
  // The toast's Undo: the title bar has an Undo, and an arrow for several steps, too.
  await page.locator("[data-sonner-toast]").getByRole("button", { name: "Undo" }).click();
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
  expect(await exportFromEditor(page, 60_000)).toContain("Saved in the folder “exported”.");

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

test("places a Media image on the Hero from the Edit panel, shows it on the canvas and exports it", async () => {
  // A site with a photo in Media and a Hero without an image.
  const store = ProjectStore.open(sitePath);
  try {
    const { hash } = store.putAsset({
      mediaId: "shop",
      data: heroPhoto(),
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
      },
    };
    const home = site.pages[site.homePageId];
    if (home === undefined) throw new Error("no home page");
    home.doc.content = [{ type: "Hero", props: { id: "hero", title: "Fresh bread" } }];
    store.saveSite(site);
  } finally {
    store.close();
  }

  const page = await openSite();
  const canvas = page.frameLocator(".editor__canvas iframe");
  await waitForCanvas(page);
  await canvas.locator("h1").click();

  // The picker dialog (UX-15): found by its alt text, chosen with Enter, focus back on the field.
  const field = page.getByRole("button", { name: "Image Choose an image…" });
  await field.click();
  const picker = page.getByRole("dialog", { name: "Choose an image" });
  await page.keyboard.type("shop front");
  await expect(picker.getByRole("option")).toHaveText(["Shop front.jpg"]);
  await page.keyboard.press("Enter");
  await expect(picker).toBeHidden();
  await expect(page.getByRole("button", { name: "Image Change image…" })).toBeFocused();
  // The canvas shows the photo through the webforge-media: scheme, with its alt text.
  const shown = canvas.locator("img");
  await expect(shown).toHaveAttribute("alt", "Our shop front");
  await expect
    .poll(() =>
      shown.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
    )
    .toBe(true);
  expect(await shown.evaluate((image: HTMLImageElement) => image.currentSrc)).toMatch(
    /^webforge-media:\/\/original\/[0-9a-f]{64}$/,
  );

  // Alt text for this placement only.
  const alt = page.getByLabel("Alt text here");
  await alt.fill("Loaves in the window");
  await alt.blur();
  await expect(shown).toHaveAttribute("alt", "Loaves in the window");
  await expect(page.getByRole("banner").getByRole("status")).toHaveText("Saved", {
    timeout: 10_000,
  });

  const folder = join(dir, "exported");
  await stubFileDialogs(running(), folder);
  expect(await exportFromEditor(page, 60_000)).toContain("Saved in the folder “exported”.");
  const index = readFileSync(join(folder, "index.html"), "utf8");
  expect(index).toContain('alt="Loaves in the window"');
  expect(index).toContain('srcSet="assets/img/shop-front-640.webp 640w');
});

test("warns before deleting a placed image, shows a placeholder, undoes it, and exports without it", async () => {
  // A site whose Hero places a photo from Media.
  const store = ProjectStore.open(sitePath);
  try {
    const { hash } = store.putAsset({
      mediaId: "shop",
      data: heroPhoto(),
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
  const canvas = page.frameLocator(".editor__canvas iframe");
  const shown = canvas.locator("img");
  await expect(shown).toHaveAttribute("alt", "Our shop front", { timeout: 30_000 });

  await page.getByRole("tab", { name: "Media" }).click();
  const panel = page.getByRole("region", { name: "Media" });
  await panel.getByRole("button", { name: "Shop front.jpg" }).click();
  await panel.getByRole("button", { name: "Delete" }).click();
  const warning = page.getByRole("alertdialog");
  await expect(warning).toContainText("Delete Shop front.jpg?");
  await expect(warning).toContainText("It's used on 1 page.");
  await warning.getByRole("button", { name: "Delete" }).click();

  // The place shows a placeholder until another image is chosen.
  await expect(shown).toHaveAttribute("alt", "Image deleted from Media");
  await expect(shown).toHaveAttribute("src", /^data:image\/svg\+xml,/);

  // One Undo brings the image back for the Hero.
  // The toast's Undo: the title bar has an Undo, and an arrow for several steps, too.
  await page.locator("[data-sonner-toast]").getByRole("button", { name: "Undo" }).click();
  await expect(shown).toHaveAttribute("alt", "Our shop front");
  await expect(panel.getByRole("button", { name: "Shop front.jpg" })).toBeVisible();

  // Deleted again, the export leaves the place out: no picture, no image files.
  await panel.getByRole("button", { name: "Shop front.jpg" }).click();
  await panel.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  const folder = join(dir, "exported");
  await stubFileDialogs(running(), folder);
  expect(await exportFromEditor(page, 60_000)).toContain("Saved in the folder “exported”.");
  const index = readFileSync(join(folder, "index.html"), "utf8");
  expect(index).toContain("Fresh bread");
  expect(index).not.toContain("<img");
  expect(existsSync(join(folder, "assets", "img"))).toBe(false);
});

test("takes documents by their name and content, and rejects a renamed program (1.28)", async () => {
  const page = await openSite();

  const result = await page.evaluate(
    async ({ docx }) => {
      const { project, media } = (window as unknown as MediaWindow).webforge;
      return media.import((await project.getCurrent())?.sessionId ?? "", [
        { fileName: "Price list.docx", data: new Uint8Array(docx) },
        { fileName: "Opening times.csv", data: new TextEncoder().encode("Day,Opens\nMon,9:00\n") },
        // A Windows program renamed to look like a PDF.
        { fileName: "Invoice.pdf", data: new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]) },
      ]);
    },
    { docx: [...minimalDocx()] },
  );

  expect(result.items?.map((item) => [item.kind, item.name])).toEqual([
    ["file", "price-list"],
    ["file", "opening-times"],
  ]);
  expect(result.rejected).toEqual([{ fileName: "Invoice.pdf", reason: "unsupported" }]);
});
