import type { MenuItemConstructorOptions } from "electron";

/**
 * The application menu (F-ED-27). The editor draws its own menus (1.2) and handles its own keys, so
 * Electron's default menu would take keys it uses: its View menu zooms the whole window on
 * Ctrl/Cmd + =, − and 0 (the canvas's zoom keys) and reloads it on Ctrl/Cmd + R. Windows and Linux
 * get no menu. macOS keeps what a Mac app needs from its menu bar: the app menu (About, Hide,
 * Quit), Edit's roles (which give text fields Cmd + C, V, X and A) and Window's. In development, a
 * menu that reloads and opens the developer tools stays.
 */
export function applicationMenu(
  platform: NodeJS.Platform,
  development: boolean,
): MenuItemConstructorOptions[] | null {
  const developer: MenuItemConstructorOptions[] = development
    ? [{ label: "Developer", submenu: [{ role: "reload" }, { role: "toggleDevTools" }] }]
    : [];
  if (platform === "darwin") {
    return [{ role: "appMenu" }, { role: "editMenu" }, ...developer, { role: "windowMenu" }];
  }
  return developer.length === 0 ? null : developer;
}
