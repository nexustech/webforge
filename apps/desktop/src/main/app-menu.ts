import { t } from "@webforge/i18n";
import type { MenuItemConstructorOptions } from "electron";
import type { NativeMenus } from "../shared/ipc/app.js";

/** The renderer's menus and how to run a command from them (LF-13). */
export type RendererMenus = {
  readonly menus: NativeMenus;
  /** Runs the renderer's command `id`. */
  readonly run: (id: string) => void;
};

/** The renderer's own Undo and Redo, which Edit's roles already give on macOS. */
const ROLE_COMMANDS: ReadonlySet<string> = new Set(["edit.undo", "edit.redo"]);

/** The items of the renderer's menu `id`, each running its command when chosen. */
function itemsOf(
  renderer: RendererMenus | undefined,
  id: NativeMenus[number]["id"],
): MenuItemConstructorOptions[] {
  const menu = renderer?.menus.find((each) => each.id === id);
  return (menu?.items ?? [])
    .filter((item) => !ROLE_COMMANDS.has(item.id))
    .map((item) => ({
      id: item.id,
      label: item.label,
      enabled: item.enabled,
      // Shown, not taken: the renderer handles its own keys (F-ED-27).
      ...(item.accelerator === undefined
        ? {}
        : { accelerator: item.accelerator, registerAccelerator: false }),
      click: () => renderer?.run(item.id),
    }));
}

/** A menu of `items` after a separator, or nothing when there are none. */
const after = (items: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] =>
  items.length === 0 ? [] : [{ type: "separator" }, ...items];

/**
 * The application menu (F-ED-27). The editor draws its own menus (1.2) and handles its own keys, so
 * Electron's default menu would take keys it uses: its View menu zooms the whole window on
 * Ctrl/Cmd + =, − and 0 (the canvas's zoom keys) and reloads it on Ctrl/Cmd + R. Windows and Linux
 * get no menu. macOS keeps what a Mac app needs from its menu bar: the app menu (About, Hide,
 * Quit), Edit's roles (which give text fields Cmd + C, V, X and A), View's full screen and Window's;
 * the editor's own menus join them there (LF-13: File, Edit, View and Help move to the menu bar),
 * their shortcuts shown but left to the editor. In development, a menu that reloads and opens the
 * developer tools stays.
 */
export function applicationMenu(
  platform: NodeJS.Platform,
  development: boolean,
  renderer?: RendererMenus,
): MenuItemConstructorOptions[] | null {
  const developer: MenuItemConstructorOptions[] = development
    ? [
        {
          label: t("app.menu.developer"),
          submenu: [{ role: "reload" }, { role: "toggleDevTools" }],
        },
      ]
    : [];
  if (platform === "darwin") {
    const file = itemsOf(renderer, "file");
    const view = itemsOf(renderer, "view");
    const help = itemsOf(renderer, "help");
    const fullScreen: MenuItemConstructorOptions = { role: "togglefullscreen" };
    return [
      { role: "appMenu" },
      ...(file.length === 0 ? [] : [{ label: t("shell.menu.file"), submenu: file }]),
      renderer === undefined
        ? { role: "editMenu" }
        : {
            label: t("shell.menu.edit"),
            submenu: [
              { role: "undo" },
              { role: "redo" },
              { type: "separator" },
              { role: "cut" },
              { role: "copy" },
              { role: "paste" },
              { role: "selectAll" },
              ...after(itemsOf(renderer, "edit")),
            ],
          },
      {
        label: t("app.menu.view"),
        submenu: view.length === 0 ? [fullScreen] : [...view, { type: "separator" }, fullScreen],
      },
      ...developer,
      { role: "windowMenu" },
      ...(help.length === 0 ? [] : [{ role: "help" as const, submenu: help }]),
    ];
  }
  return developer.length === 0 ? null : developer;
}
