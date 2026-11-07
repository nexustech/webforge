import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { createSite } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { launchDesktopApp, newUserDataDir, type WebforgeApp, waitForCanvas } from "./launch.js";

// The year a published site shows (F-CM-8, 4.5): `{year}` is filled in when the site is built, so
// once the year has turned, Site Check tips to publish again, from when the site's file says it
// last went live, and its Fix opens Publish.

let dir: string;
let userData: string;
let app: WebforgeApp | undefined;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-published-year-"));
  userData = newUserDataDir();
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  await rm(userData, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

test("tips to publish again when the published site shows last year, and opens Publish", async () => {
  const lastYear = new Date().getFullYear() - 1;
  const path = join(dir, "Rosa's Bakery.wforge");
  const site = createSite({
    name: "Rosa's Bakery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Not found",
    homeDoc: {
      root: { props: {} },
      content: [
        { type: "Text", props: { id: "copyright", text: "<p>© {year} Rosa's Bakery</p>" } },
      ],
    },
  });
  const store = ProjectStore.create(path, { name: "Rosa's Bakery" });
  store.saveSite(site);
  // Published in the summer of last year, as the site's file records it.
  store.writeLastPublishedAt(`${lastYear}-07-01T12:00:00.000Z`);
  store.close();

  app = await launchDesktopApp({ userDataDir: userData, args: [path] });
  const page = await app.firstWindow();
  await waitForCanvas(page);
  await page.getByRole("button", { name: "Show or Hide Bottom Panel" }).click();
  const tip = page
    .getByRole("region", { name: "Bottom panel" })
    .locator('[data-rule="outdatedYear"]');

  await expect(tip).toHaveAttribute("data-status", "warn");
  await expect(tip.getByText(`Shows ${lastYear}`)).toBeVisible();
  await tip.getByRole("button", { name: "Fix" }).click();
  await expect(page.getByRole("dialog", { name: "Publish" })).toBeVisible();
});
