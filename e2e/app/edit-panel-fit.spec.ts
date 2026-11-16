import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import {
  APP_START_TIMEOUT_MS,
  launchDesktopApp,
  removeWhenFree,
  type WebforgeApp,
  waitForCanvas,
} from "./launch.js";
import { stubFileDialogs } from "./sites.js";
import { createFromTemplate, TEMPLATES } from "./templates.js";

// The Edit panel fits its fields at the default layout's width (#1007): at 1440, 1024 and 960 px,
// no tab of it scrolls sideways for anything on the Café / Restaurant template's home page. At
// 240 px a Hero's fields needed 278, and two colours to a row cut their names to "Sur…".

let dir: string;
let app: WebforgeApp | undefined;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-edit-panel-fit-"));
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  void removeWhenFree(dir);
});

/** The scrolling parts of the right column wider than they are: what scrolls sideways. */
const overflowing = (page: Page) =>
  page.getByRole("region", { name: "Right panels" }).evaluate((column) =>
    [column, ...column.querySelectorAll<HTMLElement>("*")]
      .filter((element) => {
        const { overflowX } = getComputedStyle(element);
        const scrolls =
          element.dataset.slot === "scroll-area-viewport" ||
          overflowX === "auto" ||
          overflowX === "scroll";
        return scrolls && element.scrollWidth > element.clientWidth + 1;
      })
      .map((element) => `${element.className} (${element.scrollWidth} > ${element.clientWidth})`),
  );

test("fits the Edit panel to the default width, for everything on the Café's home page", async () => {
  // Every item, at three widths, in two tabs: several hundred selections.
  test.setTimeout(600_000);
  app = await launchDesktopApp({ userDataDir: join(dir, "user-data"), site: false });
  const page = await app.firstWindow();
  await expect(page.getByRole("heading", { name: "Get started" })).toBeVisible({
    timeout: APP_START_TIMEOUT_MS,
  });
  await stubFileDialogs(app, join(dir, "Café.wforge"));
  await createFromTemplate(page, TEMPLATES[0]);
  await waitForCanvas(page);

  const right = page.getByRole("region", { name: "Right panels" });
  const tree = page.getByRole("region", { name: "Left panels" }).getByRole("tree", {
    name: "Layers",
  });
  let checked = 0;
  for (const width of [1440, 1024, 960]) {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.unmaximize());
    await app.evaluate(
      ({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0]?.setContentSize(size, 900),
      width,
    );
    await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(width);
    // Every element, not only the sections: their rows open.
    await page
      .getByRole("region", { name: "Left panels" })
      .getByRole("button", { name: "Expand all" })
      .click();
    const rows = tree.getByRole("treeitem");
    for (let index = 0; index < (await rows.count()); index += 1) {
      const item = rows.nth(index);
      const name = (await item.innerText()).split("\n")[0] ?? "";
      await item.click();
      for (const tab of ["Content", "Style"]) {
        const tabButton = right.getByRole("tab", { name: tab, exact: true });
        if ((await tabButton.count()) === 0) continue;
        await tabButton.click();
        expect(await overflowing(page), `${name}, ${tab}, at ${width} px`).toEqual([]);
        checked += 1;
      }
    }
  }
  // Every item of the page, in both tabs: not a run that found nothing to check.
  console.log(`[fit] ${checked} tabs checked`);
  expect(checked).toBeGreaterThan(100);
});
