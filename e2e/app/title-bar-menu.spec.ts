import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, waitForCanvas } from "./launch.js";

// The editor's own menus in the title bar, on Windows and Linux; macOS uses the system's menu bar
// (LF-13), which menu-bar-keys.spec.ts covers.

test.skip(process.platform === "darwin", "The menus are in the system's menu bar on macOS");

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  await waitForCanvas(page);
});

test.afterEach(async () => {
  await app.close();
});

const menuBar = () => page.getByRole("menubar", { name: "App menu" });
const title = (name: string) => menuBar().getByRole("menuitem", { name, exact: true });

/** Waits until no menu is fading out: when the press used to leave its menu closed (#689). */
const closingDone = () => expect(page.locator('[role="menu"][data-state="closed"]')).toHaveCount(0);

/** Opens View and chooses Show or Hide Bottom Panel, which starts View's menu fading out. */
async function chooseFromView(): Promise<void> {
  await title("View").click();
  const view = page.getByRole("menu", { name: "View" });
  await expect(view).toBeVisible();
  await view.getByRole("menuitem", { name: "Show or Hide Bottom Panel" }).click();
}

test("opens a menu clicked while it is still closing (#689)", async () => {
  await chooseFromView();
  // Straight away, while View's menu fades out.
  await title("View").click();

  const view = page.getByRole("menu", { name: "View" });
  await expect(view).toHaveAttribute("data-state", "open");
  // And it stays open.
  await closingDone();
  await expect(view).toBeVisible();
});

test("opens another menu clicked while the first is still closing (#689)", async () => {
  await chooseFromView();
  await title("File").click();

  const file = page.getByRole("menu", { name: "File" });
  await expect(file).toHaveAttribute("data-state", "open");
  await closingDone();
  await expect(file).toBeVisible();
});

test("closes an open menu from its title, or a press outside it", async () => {
  const view = page.getByRole("menu", { name: "View" });
  await title("View").click();
  await expect(view).toBeVisible();
  await title("View").click();
  await expect(view).toBeHidden();

  await title("View").click();
  await expect(view).toBeVisible();
  await page.getByRole("region", { name: "Left panels" }).click({ position: { x: 10, y: 200 } });
  await expect(view).toBeHidden();
});

test("lists Edit in its groups, and the site's settings, theme and stylesheet under Site (#1016)", async () => {
  await title("Edit").click();
  const edit = page.getByRole("menu", { name: "Edit" });
  await expect(edit).toBeVisible();
  // Undo; clipboard; style; arranging; selecting; shared sections; notes; find.
  await expect(edit.getByRole("separator")).toHaveCount(7);
  const items = await edit.getByRole("menuitem").count();
  const box = await edit.boundingBox();
  console.log(`Edit: ${items} items, ${box?.height ?? 0} px`);
  expect(box?.height ?? Number.POSITIVE_INFINITY).toBeLessThan(540);
  await page.keyboard.press("Escape");
  await closingDone();

  // The menus' order: File, Edit, View, Site, Help.
  await expect(menuBar().getByRole("menuitem")).toHaveText([
    "File",
    "Edit",
    "View",
    "Site",
    "Help",
  ]);
  await title("Site").click();
  const site = page.getByRole("menu", { name: "Site" });
  await expect(site.getByRole("menuitem")).toHaveText([
    "Site Settings…",
    "Theme…",
    "Theme Studio…",
  ]);
  await page.keyboard.press("Escape");
  await closingDone();

  // Stylesheet joins them in Advanced mode only, and View lists no theme.
  await title("View").click();
  const view = page.getByRole("menu", { name: "View" });
  await expect(view.getByRole("menuitem", { name: /^Theme/ })).toHaveCount(0);
  await view.getByRole("menuitem", { name: "Use Advanced Mode" }).click();
  await closingDone();
  await title("Site").click();
  await expect(site.getByRole("menuitem", { name: "Stylesheet", exact: true })).toBeVisible();
});
