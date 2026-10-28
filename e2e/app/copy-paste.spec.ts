import { mkdtempSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { changedDocuments, createSite, type MediaId, type SiteDoc } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { heroPhoto } from "@webforge/test-utils";
import { clickOnCanvas } from "./canvas-click.js";
import { launchDesktopApp, launchSecondInstance, waitForCanvas } from "./launch.js";
import type { RendererWindow } from "./sites.js";

// Copy and paste (1.25, F-ED-16): elements copied in one site paste into another opened later,
// bringing the images they show into its Media, as one undo step.

let dir: string;
let userData: string;
let bakery: string;
let florist: string;
let app: ElectronApplication | undefined;

/** Creates Bakery: a home page with a Hero showing a photo from its Media. */
function createBakery(path: string): void {
  const site = createSite({
    name: "Bakery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Page not found",
  });
  const store = ProjectStore.create(path, { name: "Bakery" });
  try {
    const photo = "photo" as MediaId;
    const { hash } = store.putAsset({
      mediaId: photo,
      data: heroPhoto(),
      mime: "image/jpeg",
      width: 1200,
      height: 800,
      originalName: "shop.jpg",
    });
    site.media[photo] = {
      id: photo,
      kind: "image",
      hash,
      name: "shop",
      fileName: "shop.jpg",
      mimeType: "image/jpeg",
      width: 1200,
      height: 800,
      alt: "Our shop",
    };
    site.pages[site.homePageId]?.doc.content.push({
      type: "Hero",
      props: { id: "hero", title: "Fresh bread daily", image: { mediaId: photo } },
    });
    store.commit(changedDocuments(undefined, site));
  } finally {
    store.close();
  }
}

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-copy-paste-"));
  userData = join(dir, "user-data");
  bakery = join(dir, "Bakery.wforge");
  florist = join(dir, "Florist.wforge");
  createBakery(bakery);
  ProjectStore.create(florist, { name: "Florist" }).close();
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

const canvas = (page: Page) => page.frameLocator(".editor__canvas iframe");

test("pastes a Hero copied in another site with its photo, as one undo step", async () => {
  app = await launchDesktopApp({ args: [bakery], userDataDir: userData });
  const page = await app.firstWindow();
  await waitForCanvas(page);

  // Select the Hero by clicking its padding (clicking its text edits the text), then copy.
  await clickOnCanvas(canvas(page).locator(".site-hero"), { position: { x: 6, y: 6 } });
  await expect(
    page.getByRole("region", { name: "Right panels" }).getByRole("heading", { name: "Hero" }),
  ).toBeVisible();
  await page.keyboard.press("ControlOrMeta+c");
  await expect
    .poll(() =>
      app?.evaluate(({ clipboard }) => clipboard.has("web application/x-webforge-elements")),
    )
    .toBe(true);

  // Florist opens in the same window, as when its file is double-clicked.
  const reloaded = page.waitForEvent("load");
  expect(await launchSecondInstance({ args: [florist], userDataDir: userData })).toBe(0);
  await reloaded;
  await waitForCanvas(page);
  await expect(canvas(page).locator(".site-hero")).toHaveCount(0);

  await page.keyboard.press("ControlOrMeta+v");

  const hero = canvas(page).locator(".site-hero");
  await expect(hero).toContainText("Fresh bread daily");
  // The photo shows: Florist's file has its bytes now.
  await expect
    .poll(() => hero.locator("img").evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);
  await page.getByRole("tab", { name: "Undo History" }).click();
  await expect(page.locator(".undo-history__step").first()).toHaveText("Pasted Hero");
  await expect(page.getByRole("banner").getByRole("status")).toHaveText("Saved", {
    timeout: 10_000,
  });
  const media = await page.evaluate(async () => {
    const read = await (window as unknown as RendererWindow).webforge.project.readSite();
    return (read as { site?: { media: Record<string, { fileName: string }> } }).site?.media;
  });
  expect(media).toMatchObject({ photo: { fileName: "shop.jpg" } });

  // One undo takes the Hero and the photo away again.
  await page.keyboard.press("ControlOrMeta+z");
  await expect(hero).toHaveCount(0);
});

test("leaves Copy to text being edited on the canvas", async () => {
  app = await launchDesktopApp({ args: [bakery], userDataDir: userData });
  const page = await app.firstWindow();
  await waitForCanvas(page);
  await app.evaluate(({ clipboard }) => clipboard.writeText(""));

  const title = canvas(page).locator(".site-hero [contenteditable]").first();
  await title.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+c");

  await expect
    .poll(() => app?.evaluate(({ clipboard }) => clipboard.readText()))
    .toBe("Fresh bread daily");
  expect(
    await app.evaluate(({ clipboard }) => clipboard.has("web application/x-webforge-elements")),
  ).toBe(false);
});

test("keeps the shared Header out of copying, and pastes into the page while it is selected", async () => {
  app = await launchDesktopApp({ userDataDir: userData });
  const page = await app.firstWindow();
  await waitForCanvas(page);
  const headings = canvas(page).locator(".site-heading");
  await expect(headings).toHaveCount(1);

  // Copy the heading (selected by clicking past the end of its text).
  const box = await headings.first().boundingBox();
  if (box === null) throw new Error("Heading not visible");
  await clickOnCanvas(headings.first(), { position: { x: box.width * 0.97, y: 2 } });
  await page.keyboard.press("ControlOrMeta+c");
  await expect
    .poll(() =>
      app?.evaluate(({ clipboard }) => clipboard.has("web application/x-webforge-elements")),
    )
    .toBe(true);

  // The Header is on every page: it can't be copied.
  const header = canvas(page).locator(".site-header");
  const headerBox = await header.boundingBox();
  if (headerBox === null) throw new Error("Header not visible");
  await clickOnCanvas(header, { position: { x: headerBox.width / 2, y: 4 } });
  await expect(
    page.getByRole("region", { name: "Right panels" }).getByRole("heading", { name: "Header" }),
  ).toBeVisible();
  await page.keyboard.press("ControlOrMeta+c");
  await expect(
    page.getByText("The Header is on every page, so it can't be copied or cut."),
  ).toBeVisible();

  // Pasting with the Header selected goes into the page, not the Header.
  await page.keyboard.press("ControlOrMeta+v");
  await expect(headings).toHaveCount(2);
  await expect(header.locator(".site-heading")).toHaveCount(0);
});

test("pastes a copied image into the selected Hero, as one step with its Media item", async () => {
  app = await launchDesktopApp({ args: [bakery], userDataDir: userData });
  const page = await app.firstWindow();
  await waitForCanvas(page);
  await clickOnCanvas(canvas(page).locator(".site-hero"), { position: { x: 6, y: 6 } });
  // A screenshot on the clipboard: an image, as PNG.
  await app.evaluate(
    async ({ clipboard, ClipboardItem, nativeImage }, jpeg) => {
      const png = nativeImage.createFromBuffer(Buffer.from(jpeg)).toPNG();
      await clipboard.write([
        new ClipboardItem({ "image/png": new Blob([new Uint8Array(png)], { type: "image/png" }) }),
      ]);
    },
    [...heroPhoto()],
  );

  await page.keyboard.press("ControlOrMeta+v");

  await page.getByRole("tab", { name: "Undo History" }).click();
  await expect(page.locator(".undo-history__step").first()).toHaveText(
    "Pasted image 'Pasted image.png'",
  );
  await expect(page.getByRole("banner").getByRole("status")).toHaveText("Saved", {
    timeout: 10_000,
  });
  const site = await page.evaluate(async () => {
    const read = await (window as unknown as RendererWindow).webforge.project.readSite();
    return (read as { site?: SiteDoc }).site;
  });
  const hero = site?.pages[site.homePageId]?.doc.content.at(-1);
  const pasted = Object.values(site?.media ?? {}).find(
    (item) => item.fileName === "Pasted image.png",
  );
  expect(pasted).toMatchObject({ kind: "image", mimeType: "image/png" });
  expect(hero?.props.image).toEqual({ mediaId: pasted?.id });
});

test("places an image file copied in the file manager in an Image element of its own, and in Media (2.9)", async () => {
  app = await launchDesktopApp({ args: [florist], userDataDir: userData });
  const page = await app.firstWindow();
  await waitForCanvas(page);
  const file = join(dir, "Shop front.jpg");
  writeFileSync(file, heroPhoto());
  await app.evaluate(async ({ clipboard, ClipboardItem }, uri) => {
    await clipboard.write([
      new ClipboardItem({ "text/uri-list": new Blob([uri], { type: "text/uri-list" }) }),
    ]);
  }, pathToFileURL(file).href);

  await page.keyboard.press("ControlOrMeta+v");

  // Nothing selected takes an image: it goes in a new Image element, where Add would put one.
  const canvas = page.frameLocator(".editor__canvas iframe");
  await expect(canvas.locator(".site-image img")).toHaveCount(1);
  await page.getByRole("tab", { name: "Media" }).click();
  await expect(page.getByRole("button", { name: "Shop front.jpg" })).toBeVisible();

  // One step, undone in one go: the element and its place in Media.
  await page.keyboard.press("ControlOrMeta+z");
  await expect(canvas.locator(".site-image")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Shop front.jpg" })).toHaveCount(0);
});

test("places a copied YouTube address in an Embed video, and pastes nothing for another address (2.11)", async () => {
  app = await launchDesktopApp({ args: [florist], userDataDir: userData });
  const page = await app.firstWindow();
  await waitForCanvas(page);
  const video = page.frameLocator(".editor__canvas iframe").locator(".site-embed-video");

  // Copied text that is a web address, but not a video's: nothing to paste.
  await app.evaluate(({ clipboard }) => clipboard.writeText("https://example.com/menu"));
  await page.keyboard.press("ControlOrMeta+v");
  await expect(
    page.getByText("There's nothing to paste. Copy a section or element first."),
  ).toBeVisible();
  await expect(video).toHaveCount(0);

  // A video's address, copied from the browser's address bar.
  await app.evaluate(({ clipboard }) =>
    clipboard.writeText(" https://www.youtube.com/watch?v=dQw4w9WgXcQ\n"),
  );
  await page.keyboard.press("ControlOrMeta+v");

  await expect(video).toHaveCount(1);
  await page.getByRole("tab", { name: "Undo History" }).click();
  await expect(page.locator(".undo-history__step").first()).toHaveText("Added Embed video");
  await expect(page.getByRole("banner").getByRole("status")).toHaveText("Saved", {
    timeout: 10_000,
  });
  const site = await page.evaluate(async () => {
    const read = await (window as unknown as RendererWindow).webforge.project.readSite();
    return (read as { site?: SiteDoc }).site;
  });
  const placed = JSON.stringify(site?.pages[site.homePageId]?.doc.content);
  expect(placed).toContain('"address":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"');

  // In a text field, pasting a video's address pastes the text: no other Embed video.
  await app.evaluate(({ clipboard }) => clipboard.writeText("https://vimeo.com/76979871"));
  const field = page.getByRole("textbox", { name: "Video address" });
  await field.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+v");
  await expect(field).toHaveValue("https://vimeo.com/76979871");
  await expect(video).toHaveCount(1);
});
