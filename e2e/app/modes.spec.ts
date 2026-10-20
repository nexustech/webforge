import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { ProjectStore } from "@webforge/storage";
import { launchDesktopApp } from "./launch.js";

// Design | Content (M3, 1.10): switching is instant, locks the layout in Content mode and is
// remembered with the site. Simple | Advanced is a per-person preference.

let dir: string;
let sitePath: string;
let app: ElectronApplication | undefined;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-modes-"));
  sitePath = join(dir, "Modes.wforge");
  ProjectStore.create(sitePath, { name: "Modes" }).close();
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

/** Starts Webforge with the site, as a double-click on the file does, and waits for the canvas. */
async function openSite(): Promise<Page> {
  app = await launchDesktopApp({ args: [sitePath] });
  const page = await app.firstWindow();
  await expect(canvas(page).locator("style[data-webforge-site-css]")).toHaveCount(1, {
    timeout: 30_000,
  });
  return page;
}

const canvas = (page: Page) => page.frameLocator(".editor__canvas iframe");
const modeButton = (page: Page, name: "Design" | "Content") =>
  page.getByRole("radio", { name, exact: true });
/** A button of Puck's action bar on the selected element, drawn inside the canvas frame. */
const action = (page: Page, title: "Duplicate" | "Delete") =>
  canvas(page).locator(`[class*="ActionBarAction"][title="${title}"]`);

/** Selects the starter heading, so Puck shows its action bar for it. */
async function selectHeading(page: Page): Promise<void> {
  await canvas(page).locator("h1").click();
  await expect(action(page, "Duplicate")).toBeVisible();
}

test.describe("editor modes", () => {
  test("switches to Content mode without a reload, locking the layout, and remembers it", async () => {
    let page = await openSite();
    await expect(modeButton(page, "Design")).toHaveAttribute("data-state", "on");
    await selectHeading(page);
    await expect(action(page, "Delete")).toBeVisible();

    await modeButton(page, "Content").click();

    await expect(modeButton(page, "Content")).toHaveAttribute("data-state", "on");
    // Same page, no reload: the heading is still on the canvas; deleting and duplicating are off.
    await expect(canvas(page).locator("h1")).toBeVisible();
    await expect(action(page, "Delete")).toHaveCount(0);

    await app?.close();
    page = await openSite();

    await expect(modeButton(page, "Content")).toHaveAttribute("data-state", "on");
  });

  test("turns Advanced mode on from the View menu", async () => {
    const page = await openSite();

    await page.getByRole("menuitem", { name: "View" }).click();
    await page.getByRole("menuitem", { name: "Use Advanced Mode" }).click();
    await expect(page.getByRole("menu")).toHaveCount(0);
    await page.getByRole("menuitem", { name: "View" }).click();

    await expect(page.getByRole("menuitem", { name: "Use Simple Mode" })).toBeVisible();
  });
});
