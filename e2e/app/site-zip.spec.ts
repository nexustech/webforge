import { existsSync, mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { createSite, type MediaId } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { heroPhoto } from "@webforge/test-utils";
import { OPEN_WAIT } from "./budget.js";
import { launchDesktopApp, type WebforgeApp, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";
import { type RendererWindow, stubFileDialogs } from "./sites.js";

// A site's ZIP (4.7, F-SITE-5): File › Save a Copy as ZIP… saves the whole site, its Media and
// versions, and File › Open Site from ZIP… opens it again as a new site, with nothing lost.

let dir: string;
let app: WebforgeApp | undefined;

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

/** Rosa's Bakery: its home page titled "Fresh bread", a photo in Media, and a saved version. */
function bakery(path: string): void {
  const site = createSite({
    name: "Rosa's Bakery",
    language: "en",
    homeTitle: "Fresh bread",
    notFoundTitle: "Not found",
  });
  const store = ProjectStore.create(path, { name: "Rosa's Bakery" });
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
      kind: "image",
      hash,
      name: "shop-front",
      fileName: "Shop front.jpg",
      mimeType: "image/jpeg",
      width: 1600,
      height: 1000,
      alt: "Our shop front",
    },
  };
  store.saveSite(site);
  store.saveVersion("Before the redesign", "manual");
  store.close();
}

/** The open site's name and file, as the renderer knows them. */
const current = (page: Page) =>
  page
    .evaluate(async () => {
      const summary = await (window as unknown as RendererWindow).webforge.project.getCurrent();
      return summary === null ? null : `${summary.name} (${summary.fileName})`;
    })
    // While the window starts over with another site, there is no page to ask.
    .catch(() => undefined);

test("saves a copy of the site as a ZIP and opens it again as a new site", async () => {
  dir = mkdtempSync(join(tmpdir(), "webforge-site-zip-"));
  const original = join(dir, "Rosa's Bakery.wforge");
  const zip = join(dir, "Rosa's Bakery.zip");
  const copy = join(dir, "Copy.wforge");
  bakery(original);
  app = await launchDesktopApp({ args: [original] });
  const page = await app.firstWindow();
  await waitForCanvas(page);

  // Saved where the save dialog says.
  await stubFileDialogs(app, zip);
  await chooseFromMenu(app, page, "File", "Save a Copy as ZIP");
  await expect(page.getByText("Saved a copy of your site as “Rosa's Bakery.zip”.")).toBeVisible();
  expect(existsSync(zip)).toBe(true);
  // The save can finish before File's menu has finished closing, and a click on File while it
  // closes leaves it closed (#689): wait until it has gone.
  await expect(page.getByRole("menu")).toHaveCount(0);

  // Opened from the ZIP the open dialog gives, as a new site where the save dialog says.
  await app.evaluate(
    ({ dialog }, paths) => {
      Object.assign(dialog, {
        showOpenDialog: async () => ({ canceled: false, filePaths: [paths.zip] }),
        showSaveDialog: async () => ({ canceled: false, filePath: paths.copy }),
      });
    },
    { zip, copy },
  );
  await chooseFromMenu(app, page, "File", "Open Site from ZIP");
  await expect
    .poll(() => current(page), { timeout: OPEN_WAIT })
    .toBe("Rosa's Bakery (Copy.wforge)");
  await waitForCanvas(page);
  await app.close();
  app = undefined;

  // The new site holds what the original did: its pages, its photo and its version.
  const [before, after] = [original, copy].map((path) =>
    ProjectStore.open(path, { readOnly: true }),
  );
  if (before === undefined || after === undefined) throw new Error("A site didn't open");
  try {
    expect(after.readDocuments()).toEqual(before.readDocuments());
    expect(after.listAssets()).toEqual(before.listAssets());
    expect(after.listVersions()).toEqual(before.listVersions());
    expect(after.readSite().pages[after.readSite().homePageId]?.title).toBe("Fresh bread");
  } finally {
    before.close();
    after.close();
  }
});
