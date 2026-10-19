import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp } from "./launch.js";
import { stubFileDialogs } from "./sites.js";

// Export from the editor: the canvas page is built in the export utility process and written to
// the folder chosen in the (stubbed) dialog.

let app: ElectronApplication;
let page: Page;
const parent = mkdtempSync(join(tmpdir(), "webforge-e2e-export-"));

test.beforeAll(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
});

test.afterAll(async () => {
  await app.close();
  rmSync(parent, { recursive: true, force: true });
});

test.describe("Export site", () => {
  test("builds the page on the canvas into a self-contained folder", async () => {
    const folder = join(parent, "my-site");
    await stubFileDialogs(app, folder);

    await page.getByRole("button", { name: "Export site" }).click();

    await expect(page.getByText("Site exported to “my-site” (5 files).")).toBeVisible({
      timeout: 30_000,
    });
    const index = readFileSync(join(folder, "index.html"), "utf8");
    expect(index).toContain("<!doctype html>");
    expect(index).toContain("Welcome to our business");
    expect(index).toMatch(/<script defer src="assets\/js\/webforge\.[0-9a-f]{10}\.js">/);
    expect(readdirSync(join(folder, "assets")).sort()).toEqual(["css", "fonts", "js"]);
    expect(existsSync(join(folder, ".webforge-export"))).toBe(true);
  });

  test("refuses a folder with other files and changes nothing", async () => {
    const folder = mkdtempSync(join(parent, "documents-"));
    writeFileSync(join(folder, "notes.txt"), "mine");
    await stubFileDialogs(app, folder);

    await page.getByRole("button", { name: "Export site" }).click();

    await expect(
      page.getByText("That folder already contains other files. Choose an empty folder"),
    ).toBeVisible({ timeout: 30_000 });
    expect(readdirSync(folder)).toEqual(["notes.txt"]);
  });
});
