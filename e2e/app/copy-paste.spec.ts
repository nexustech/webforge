import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { changedDocuments, createSite, type MediaId } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { heroPhoto } from "@webforge/test-utils";
import { launchDesktopApp, launchSecondInstance } from "./launch.js";
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
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

const canvas = (page: Page) => page.frameLocator(".editor__canvas iframe");

async function waitForCanvas(page: Page): Promise<void> {
  await expect(canvas(page).locator("style[data-webforge-site-css]")).toHaveCount(1, {
    timeout: 30_000,
  });
}

test("pastes a Hero copied in another site with its photo, as one undo step", async () => {
  app = await launchDesktopApp({ args: [bakery], userDataDir: userData });
  const page = await app.firstWindow();
  await waitForCanvas(page);

  // Select the Hero by clicking its padding (clicking its text edits the text), then copy.
  await canvas(page)
    .locator(".site-hero")
    .click({ position: { x: 6, y: 6 } });
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
