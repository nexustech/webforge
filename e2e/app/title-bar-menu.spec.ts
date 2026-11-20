import { type ElectronApplication, expect, type Locator, type Page, test } from "@playwright/test";
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
  // Wide enough for the menus' titles, which fold into one Menu button below 1280 px (#1166).
  await sizeWindow(1440, 900);
});

/** Makes the window's content width × height. */
async function sizeWindow(width: number, height: number): Promise<void> {
  await app.evaluate(
    ({ BrowserWindow }, [w, h]) => {
      const main = BrowserWindow.getAllWindows()[0];
      main?.unmaximize();
      main?.setContentSize(w, h);
    },
    [width, height] as const,
  );
  await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(width);
}

test.afterEach(async () => {
  await app.close();
});

const menuBar = () => page.getByRole("menubar", { name: "App menu" });
const title = (name: string) => menuBar().getByRole("menuitem", { name, exact: true });

/** Waits until no menu is fading out: when the press used to leave its menu closed (#689). */
const closingDone = () => expect(page.locator('[role="menu"][data-state="closed"]')).toHaveCount(0);

/** Where `menu`'s bottom edge is on the page, in CSS pixels. */
async function bottomOf(menu: Locator): Promise<number> {
  const box = await menu.boundingBox();
  return box === null ? Number.POSITIVE_INFINITY : box.y + box.height;
}

/** Whether all of `item` is in sight in `menu`, which scrolls when it doesn't fit (#1015). */
async function isShownIn(item: Locator, menu: Locator): Promise<boolean> {
  const [inner, outer] = await Promise.all([item.boundingBox(), menu.boundingBox()]);
  if (inner === null || outer === null) return false;
  return inner.y >= outer.y && inner.y + inner.height <= outer.y + outer.height;
}

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

test("groups File and View to fit a 600 px window, and opens the history panels and Site Check from the menus (#1165)", async () => {
  // As short as the smallest window (MIN_WINDOW_SIZE), wide enough for the menus' titles.
  await sizeWindow(1280, 600);
  await expect.poll(() => page.evaluate(() => window.innerHeight)).toBeLessThanOrEqual(600);
  const windowHeight = await page.evaluate(() => window.innerHeight);

  for (const name of ["File", "View"]) {
    await title(name).click();
    const menu = page.getByRole("menu", { name });
    await expect(menu).toBeVisible();
    // All of it in the window, with no scrolling, and no run of more than seven items.
    await expect.poll(() => bottomOf(menu)).toBeLessThanOrEqual(windowHeight);
    const fits = await menu.evaluate((root) => root.scrollHeight <= root.clientHeight + 1);
    expect(fits, name).toBe(true);
    const runs = await menu.evaluate((root) => {
      const lengths = [0];
      for (const each of root.children) {
        if (each.getAttribute("role") === "separator") lengths.push(0);
        else lengths[lengths.length - 1] = (lengths.at(-1) ?? 0) + 1;
      }
      return lengths;
    });
    expect(runs.length, name).toBeGreaterThan(1);
    expect(Math.max(...runs), name).toBeLessThanOrEqual(7);
    await page.keyboard.press("Escape");
    await closingDone();
  }

  // Each from its menu: the panels were only icons in a tab strip.
  const left = page.getByRole("region", { name: "Left panels" });
  await title("Site").click();
  await page
    .getByRole("menu", { name: "Site" })
    .getByRole("menuitem", { name: /^Version History/ })
    .click();
  await expect(left.getByRole("tab", { name: "Version History" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await closingDone();
  await title("View").click();
  await page
    .getByRole("menu", { name: "View" })
    .getByRole("menuitem", { name: "Undo History" })
    .click();
  await expect(left.getByRole("tab", { name: "Undo History" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await closingDone();
  await title("Site").click();
  await page
    .getByRole("menu", { name: "Site" })
    .getByRole("menuitem", { name: /^Site Check/ })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Bottom panel" })
      .getByRole("tab", { name: "Site Check", selected: true }),
  ).toBeVisible();

  // And from Search Commands, by name.
  for (const name of ["Version History", "Undo History", "Site Check"]) {
    await page.getByRole("button", { name: /^Search commands/ }).click();
    const box = page.getByRole("dialog", { name: "Commands" });
    await box.getByRole("combobox").fill(name);
    await expect(box.getByRole("option", { name: new RegExp(`^${name}`) }).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(box).toBeHidden();
  }
});

test("lists Edit in its groups, and the site's settings, theme and stylesheet under Site (#1016)", async () => {
  // As short as the smallest window (MIN_WINDOW_SIZE), where Edit is taller than the room below
  // it, and wide enough for the menus' titles.
  await sizeWindow(1280, 600);
  await expect.poll(() => page.evaluate(() => window.innerHeight)).toBeLessThanOrEqual(600);
  const windowHeight = await page.evaluate(() => window.innerHeight);

  await title("Edit").click();
  const edit = page.getByRole("menu", { name: "Edit" });
  await expect(edit).toBeVisible();
  // Undo; clipboard; arranging; the Style, Select and Shared Section submenus; notes; find.
  await expect(edit.getByRole("separator")).toHaveCount(5);
  // It ends inside the window and scrolls instead (#1015)…
  await expect.poll(() => bottomOf(edit)).toBeLessThanOrEqual(windowHeight);
  // …so its last item can still be reached, and is shown in it.
  await edit.getByRole("menuitem").first().focus();
  await page.keyboard.press("End");
  const last = edit.locator('[role="menuitem"]:not([data-disabled])').last();
  await expect(last).toBeFocused();
  await expect.poll(() => isShownIn(last, edit)).toBe(true);

  // → opens a submenu, ← closes it; a disabled item there still says why.
  const styleItem = edit.getByRole("menuitem", { name: "Style", exact: true });
  await styleItem.focus();
  await page.keyboard.press("ArrowRight");
  const style = page.getByRole("menu", { name: "Style" });
  await expect(style.getByRole("menuitem")).toHaveText([
    /^Style This…/,
    /^Copy Style/,
    /^Paste Style/,
    /^Apply Look/,
    /^Apply Look/,
  ]);
  await expect(style.getByRole("menuitem", { name: /^Paste Style/ })).toHaveAttribute(
    "aria-description",
    /.+/,
  );
  await page.keyboard.press("ArrowLeft");
  await expect(style).toBeHidden();
  await expect(styleItem).toBeFocused();

  // Shared Section's items are named without its word; the command box keeps the full names.
  await edit.getByRole("menuitem", { name: "Shared Section", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  const shared = page.getByRole("menu", { name: "Shared Section" });
  // Opened near the bottom, it stays inside the window too.
  await expect(shared).toBeVisible();
  await expect.poll(() => bottomOf(shared)).toBeLessThanOrEqual(windowHeight);
  await expect(shared.getByRole("menuitem")).toHaveText([
    /^Save as Shared Section…/,
    /^Rename…/,
    /^Delete…/,
    /^Detach/,
    /^Paste as Linked Copy/,
  ]);
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
    /^Site Check/,
    /^Version History/,
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
