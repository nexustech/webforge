import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, waitForCanvas } from "./launch.js";
import { chooseFromMenu } from "./menus.js";

// The interface zoom (View › Zoom In Interface, Ctrl/Cmd + Alt + =, − and 0): the whole window's
// scale, as VS Code zooms, kept after a restart. The canvas's own zoom (Ctrl/Cmd + =, − and 0)
// stays as it is.

let app: ElectronApplication | undefined;
let page: Page;

test.afterEach(async () => {
  await app?.close();
});

/** The editor window's zoom factor, as Electron has it. */
const zoomFactor = () =>
  (app as ElectronApplication).evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.webContents.getZoomFactor(),
  );

/** The canvas toolbar's zoom: "fit", or a scale. */
const canvasZoom = () =>
  page.getByRole("toolbar", { name: "Canvas" }).getByRole("combobox", { name: "Zoom" });

async function launch(userDataDir: string): Promise<void> {
  app = await launchDesktopApp({ userDataDir });
  page = await app.firstWindow();
  await waitForCanvas(page);
}

test("zooms the interface in, out and back to 100% from its keys and the View menu, and keeps it", async () => {
  const userDataDir = join(mkdtempSync(join(tmpdir(), "webforge-zoom-")), "user-data");
  await launch(userDataDir);
  const canvasBefore = await canvasZoom().inputValue();
  const width = await page.evaluate(() => window.innerWidth);

  await page.keyboard.press("ControlOrMeta+Alt+Equal");
  await expect.poll(zoomFactor).toBeCloseTo(1.1);
  await page.keyboard.press("ControlOrMeta+Alt+Equal");
  await expect.poll(zoomFactor).toBeCloseTo(1.25);
  // The page lays out in fewer of its own pixels: everything in it is bigger.
  await expect.poll(() => page.evaluate(() => window.innerWidth)).toBeLessThan(width);
  // Not the canvas's zoom.
  await expect(canvasZoom()).toHaveValue(canvasBefore);

  await page.keyboard.press("ControlOrMeta+Alt+Minus");
  await expect.poll(zoomFactor).toBeCloseTo(1.1);
  await chooseFromMenu(app as ElectronApplication, page, "View", "Zoom In Interface");
  await expect.poll(zoomFactor).toBeCloseTo(1.25);

  // Kept after a restart, from the first paint.
  await (app as ElectronApplication).close();
  await launch(userDataDir);
  await expect.poll(zoomFactor).toBeCloseTo(1.25);

  await page.keyboard.press("ControlOrMeta+Alt+Digit0");
  await expect.poll(zoomFactor).toBeCloseTo(1);
  await chooseFromMenu(app as ElectronApplication, page, "View", "Zoom Out Interface");
  await expect.poll(zoomFactor).toBeCloseTo(0.9);
  await chooseFromMenu(app as ElectronApplication, page, "View", "Reset Interface Zoom");
  await expect.poll(zoomFactor).toBeCloseTo(1);
});

test("stops at its largest and smallest levels, the window kept within the screen", async () => {
  await launch(join(mkdtempSync(join(tmpdir(), "webforge-zoom-")), "user-data"));

  for (let step = 0; step < 8; step++) await page.keyboard.press("ControlOrMeta+Alt+Equal");
  await expect.poll(zoomFactor).toBeCloseTo(1.5);
  // The title bar's buttons stay on screen and work: the editor is usable at the limit.
  await expect(page.getByRole("button", { name: "Undo" }).first()).toBeInViewport();
  const fits = await (app as ElectronApplication).evaluate(({ BrowserWindow, screen }) => {
    const window = BrowserWindow.getAllWindows()[0];
    if (window === undefined) return false;
    const [minWidth = 0, minHeight = 0] = window.getMinimumSize();
    const area = screen.getDisplayMatching(window.getBounds()).workArea;
    return minWidth <= Math.max(area.width, 960) && minHeight <= Math.max(area.height, 600);
  });
  expect(fits).toBe(true);

  if (process.platform === "win32") {
    // The native controls grow with the title bar, which the zoom scales (#484's check, zoomed).
    const heights = await page.evaluate(() => {
      const overlay = (
        navigator as { windowControlsOverlay?: { getTitlebarAreaRect(): DOMRect } }
      ).windowControlsOverlay?.getTitlebarAreaRect();
      return {
        bar: document.querySelector("header")?.getBoundingClientRect().height,
        controls: overlay?.height,
      };
    });
    expect(heights.bar).toBe(40);
    expect(heights.controls).toBeCloseTo(40, 0);
  }

  for (let step = 0; step < 8; step++) await page.keyboard.press("ControlOrMeta+Alt+Minus");
  await expect.poll(zoomFactor).toBeCloseTo(0.8);
  await expect(page.getByRole("button", { name: "Undo" }).first()).toBeInViewport();
});
