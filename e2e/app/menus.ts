import { type ElectronApplication, expect, type Page } from "@playwright/test";

// The editor's menus (File, Edit, View, Help): in the title bar on Windows and Linux, in the
// system's menu bar on macOS (LF-13), where a test chooses an item through Electron's own menu.

/** Whether macOS's menu bar holds the menus. */
const nativeMenus = process.platform === "darwin";

/** An item's label: its start, or a pattern it matches (`/^Delete(?! shared)/`). */
type ItemName = string | RegExp;

/** In the menu bar's menu `menu`, the item named `item`: clicked, or looked for. */
function inMenuBar(
  app: ElectronApplication,
  menu: string,
  item: ItemName,
  click: boolean,
): Promise<boolean> {
  // A pattern crosses into the main process as its source and flags.
  const [start, source, flags] =
    typeof item === "string" ? [item, null, ""] : ["", item.source, item.flags];
  return app.evaluate(
    ({ Menu }, [menuLabel, itemStart, itemSource, itemFlags, clickIt]) => {
      const named = (label: string) =>
        itemSource === null
          ? label.startsWith(itemStart)
          : new RegExp(itemSource, itemFlags).test(label);
      const top = Menu.getApplicationMenu()?.items.find((each) => each.label === menuLabel);
      const found = top?.submenu?.items.find((each) => named(each.label));
      if (found === undefined || !found.enabled) return false;
      if (clickIt) found.click();
      return true;
    },
    [menu, start, source, flags, click] as const,
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
  await page.getByRole("menuitem", { name: item }).click();
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
  const found = (await page.getByRole("menuitem", { name: item }).count()) > 0;
  await page.keyboard.press("Escape");
  return found;
}
