import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { changedDocuments, createSite, type PageId, type SiteDoc } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { countNodes, largePage } from "@webforge/test-utils";
import { launchDesktopApp } from "./launch.js";
import type { RendererWindow } from "./sites.js";

// Periodic autosave (P2, F-SITE-3): the site is saved about 2 s after editing pauses and when the
// window closes, so a crash loses at most the last few seconds.

const STARTER_HEADING = "Welcome to our business";

let dir: string;
let sitePath: string;
let app: ElectronApplication | undefined;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-autosave-"));
  sitePath = join(dir, "Autosave.wforge");
  // A new, empty site, as the start screen will create one (1.8).
  ProjectStore.create(sitePath, { name: "Autosave" }).close();
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

/**
 * Ends the app abruptly, as a crash or a power cut would: no close handlers, no last save. The
 * whole process tree goes, so no orphaned renderer keeps the site folder busy on Windows.
 */
async function killApp(): Promise<void> {
  const child = app?.process();
  const closed = app?.waitForEvent("close").catch(() => undefined);
  if (child?.pid !== undefined && process.platform === "win32") {
    execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
  } else {
    child?.kill("SIGKILL");
  }
  await closed;
  app = undefined;
}

/** Closes the window as the user does (the title bar's close button), then waits for the app. */
async function closeWindow(): Promise<void> {
  const closed = app?.waitForEvent("close");
  await app?.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.close();
  });
  await closed;
  app = undefined;
}

/** Starts Webforge with the site, as a double-click on the file does, and waits for the canvas. */
async function openSite(): Promise<Page> {
  app = await launchDesktopApp({ args: [sitePath] });
  const page = await app.firstWindow();
  // The first canvas render after a killed run can take a while on a busy machine. The site CSS
  // changes the layout when it arrives; clicks need the final positions.
  await expect(canvas(page).locator("style[data-webforge-site-css]")).toHaveCount(1, {
    timeout: 30_000,
  });
  return page;
}

const canvas = (page: Page) => page.frameLocator(".editor__canvas iframe");
const saveStatus = (page: Page) => page.locator(".app__header").getByRole("status");

/** Types `text` at the end of the starter heading, as a user editing it on the canvas. */
async function typeIntoHeading(page: Page, text: string): Promise<void> {
  const field = canvas(page).locator("h1 [contenteditable]");
  await field.hover();
  await expect(field).toHaveAttribute("contenteditable", "plaintext-only");
  await field.click();
  await page.keyboard.press("End");
  await page.keyboard.type(text, { delay: 20 });
  await expect(canvas(page).locator("h1")).toHaveText(`${STARTER_HEADING}${text}`);
}

test.describe("autosave", () => {
  test("writes a new site straight away and shows Saved", async () => {
    const page = await openSite();

    await expect(saveStatus(page)).toHaveText("Saved");
    await expect(canvas(page).locator("h1")).toHaveText(STARTER_HEADING);
  });

  test("keeps an edit when the app is killed 3 s later", async () => {
    let page = await openSite();
    await expect(saveStatus(page)).toHaveText("Saved");

    await typeIntoHeading(page, " today");
    await expect(saveStatus(page)).toHaveText("Saving…");
    const start = await page.evaluate(() => Date.now());
    await expect.poll(() => page.evaluate(() => Date.now())).toBeGreaterThan(start + 3_000);
    await killApp();

    page = await openSite();
    await expect(canvas(page).locator("h1")).toHaveText(`${STARTER_HEADING} today`);
  });

  test("saves the last edit when the window closes, without waiting for the pause", async () => {
    let page = await openSite();
    await expect(saveStatus(page)).toHaveText("Saved");

    await typeIntoHeading(page, "!");
    await closeWindow();

    page = await openSite();
    await expect(canvas(page).locator("h1")).toHaveText(`${STARTER_HEADING}!`);
  });

  test("Ctrl/Cmd+S saves now", async () => {
    const page = await openSite();
    await expect(saveStatus(page)).toHaveText("Saved");

    await typeIntoHeading(page, " now");
    await page.locator(".app__title").click();
    await page.keyboard.press("ControlOrMeta+s");

    await expect(saveStatus(page)).toHaveText("Saved");
  });

  test("commits one changed page of a 225-node site in under 50 ms", async () => {
    // Measured from the renderer: IPC, the main process's check of the whole site, and the
    // SQLite transaction with fsync (budget from architecture §10, ADR 0003).
    const doc = largePage();
    expect(countNodes(doc)).toBeGreaterThanOrEqual(225);
    const base = createSite({
      name: "Large",
      language: "en",
      homeTitle: "Home",
      notFoundTitle: "Page not found",
      homeDoc: doc,
    });
    const edits: SiteDoc[] = Array.from({ length: 7 }, (_, index) => {
      const home = base.pages[base.homePageId];
      if (home === undefined) throw new Error("no home page");
      return {
        ...base,
        pages: { ...base.pages, [base.homePageId as PageId]: { ...home, title: `Home ${index}` } },
      };
    });
    const changeLists = edits.map((site, index) =>
      changedDocuments(index === 0 ? base : edits[index - 1], site),
    );
    const store = ProjectStore.open(sitePath);
    store.saveSite(base);
    store.close();
    const page = await openSite();
    await expect(saveStatus(page)).toHaveText("Saved");

    const durations = await page.evaluate(
      async ({ changes }) => {
        const { project } = (window as unknown as RendererWindow).webforge;
        const times: number[] = [];
        for (const list of changes) {
          const start = performance.now();
          const result = await project.commit(list);
          times.push(performance.now() - start);
          if ((result as { status: string }).status !== "saved") throw new Error("not saved");
        }
        return times;
      },
      { changes: changeLists },
    );

    const sorted = [...durations].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? Number.POSITIVE_INFINITY;
    console.log(`Commit of one 225-node page: median ${median.toFixed(1)} ms`, durations);
    expect(median).toBeLessThan(50);
  });
});
