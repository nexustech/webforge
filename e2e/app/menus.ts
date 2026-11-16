import { type ElectronApplication, expect, type Page } from "@playwright/test";

// The editor's menus (File, Edit, View, Site, Help): in the title bar on Windows and Linux, in the
// system's menu bar on macOS (LF-13), where a test chooses an item through Electron's own menu.

/** Whether macOS's menu bar holds the menus. */
const nativeMenus = process.platform === "darwin";

/** An item's label: its start, or a pattern it matches (`/^Delete(?! shared)/`). */
type ItemName = string | RegExp;

/**
 * `item` as the one pattern both menu bars match it by (#1016 review): a string is the start of the
 * label, case and all, in the title bar's menus as in macOS's, so a spec can't pass on one alone.
 */
const patternOf = (item: ItemName): RegExp =>
  typeof item === "string" ? new RegExp(`^${item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) : item;

/** In the menu bar's menu `menu`, the item named `item`: clicked, or looked for. */
function inMenuBar(
  app: ElectronApplication,
  menu: string,
  item: ItemName,
  click: boolean,
): Promise<boolean> {
  // A pattern crosses into the main process as its source and flags.
  const { source, flags } = patternOf(item);
  return app.evaluate(
    ({ Menu }, [menuLabel, itemSource, itemFlags, clickIt]) => {
      const named = (label: string) => new RegExp(itemSource, itemFlags).test(label);
      const top = Menu.getApplicationMenu()?.items.find((each) => each.label === menuLabel);
      const found = top?.submenu?.items.find((each) => named(each.label));
      if (found === undefined || !found.enabled) return false;
      if (clickIt) found.click();
      return true;
    },
    [menu, source, flags, click] as const,
  );
}

/** Chooses `item` (the start of its label, or a pattern) in the editor's menu `menu` ("File"…). */
export async function chooseFromMenu(
  app: ElectronApplication,
  page: Page,
  menu: string,
  item: ItemName,
): Promise<void> {
  if (nativeMenus) {
    // The renderer sends its menus once its commands are registered.
    await expect.poll(() => inMenuBar(app, menu, item, true)).toBe(true);
    return;
  }
  await page.getByRole("menuitem", { name: menu, exact: true }).click();
  await page.getByRole("menuitem", { name: patternOf(item) }).click();
}

/** Whether the editor's menu `menu` lists an item whose label starts with `item`. */
export async function hasMenuItem(
  app: ElectronApplication,
  page: Page,
  menu: string,
  item: string,
): Promise<boolean> {
  if (nativeMenus) return inMenuBar(app, menu, item, false);
  await page.getByRole("menuitem", { name: menu, exact: true }).click();
  const found = (await page.getByRole("menuitem", { name: patternOf(item) }).count()) > 0;
  await page.keyboard.press("Escape");
  return found;
}

/** In the menu bar's menu `menu`, the labels of the submenu `submenu` opens, separators left out. */
function submenuInMenuBar(
  app: ElectronApplication,
  menu: string,
  submenu: string,
): Promise<{ readonly label: string; readonly enabled: boolean }[]> {
  return app.evaluate(
    ({ Menu }, [menuLabel, submenuLabel]) => {
      const top = Menu.getApplicationMenu()?.items.find((each) => each.label === menuLabel);
      const opener = top?.submenu?.items.find((each) => each.label === submenuLabel);
      return (opener?.submenu?.items ?? [])
        .filter((each) => each.type !== "separator")
        .map((each) => ({ label: each.label, enabled: each.enabled }));
    },
    [menu, submenu] as const,
  );
}

/**
 * The items of the submenu `submenu` in the editor's menu `menu` (File › Open Recent, 3.18): their
 * labels, and whether each can be chosen.
 */
export async function submenuItems(
  app: ElectronApplication,
  page: Page,
  menu: string,
  submenu: string,
): Promise<{ readonly label: string; readonly enabled: boolean }[]> {
  if (nativeMenus) return submenuInMenuBar(app, menu, submenu);
  await page.getByRole("menuitem", { name: menu, exact: true }).click();
  await page.getByRole("menuitem", { name: submenu, exact: true }).click();
  const items = page.getByRole("menu", { name: submenu }).getByRole("menuitem");
  await expect(items.first()).toBeVisible();
  const found = await items.evaluateAll((elements) =>
    elements.map((element) => ({
      label: element.textContent ?? "",
      enabled: element.getAttribute("aria-disabled") !== "true",
    })),
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  return found;
}

/**
 * Chooses `item` (the start of its label, or a pattern) in the submenu `submenu` of the editor's
 * menu `menu`: File › Open Recent (3.18), Edit › Style (#1016).
 */
export async function chooseFromSubmenu(
  app: ElectronApplication,
  page: Page,
  menu: string,
  submenu: string,
  item: ItemName,
): Promise<void> {
  if (nativeMenus) {
    const { source, flags } = patternOf(item);
    // The renderer sends its menus once its commands are registered.
    await expect
      .poll(() =>
        app.evaluate(
          ({ Menu }, [menuLabel, submenuLabel, itemSource, itemFlags]) => {
            const named = (label: string) => new RegExp(itemSource, itemFlags).test(label);
            const top = Menu.getApplicationMenu()?.items.find((each) => each.label === menuLabel);
            const opener = top?.submenu?.items.find((each) => each.label === submenuLabel);
            const found = opener?.submenu?.items.find((each) => named(each.label));
            if (found === undefined || !found.enabled) return false;
            found.click();
            return true;
          },
          [menu, submenu, source, flags] as const,
        ),
      )
      .toBe(true);
    return;
  }
  await page.getByRole("menuitem", { name: menu, exact: true }).click();
  await page.getByRole("menuitem", { name: submenu, exact: true }).click();
  await page
    .getByRole("menu", { name: submenu })
    .getByRole("menuitem", { name: patternOf(item) })
    .click();
}
