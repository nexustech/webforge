import { t } from "@webforge/i18n";
import type { MenuItemConstructorOptions } from "electron";
import type { NativeMenus } from "../shared/ipc/app.js";

/** The renderer's menus and how to run a command from them (LF-13). */
export type RendererMenus = {
  readonly menus: NativeMenus;
  /** Runs the renderer's command `id`. */
  readonly run: (id: string) => void;
};

/**
 * The editor's Undo and Redo, in place of Edit's roles, which would undo only text. They take the
 * keys the page leaves (Cmd+Z in a dialog's text field), and the renderer gives those to the text.
 */
const UNDO_REDO: readonly string[] = ["edit.undo", "edit.redo"];

/** The items of the renderer's menu `id`, each running its command when chosen. */
function itemsOf(
  renderer: RendererMenus | undefined,
  id: NativeMenus[number]["id"],
): MenuItemConstructorOptions[] {
  const menu = renderer?.menus.find((each) => each.id === id);
  return (menu?.items ?? []).map((item) => ({
    id: item.id,
    label: item.label,
    enabled: item.enabled,
    // Shown, not taken: the renderer handles its own keys (F-ED-27), Undo's and Redo's aside.
    ...(item.accelerator === undefined
      ? {}
      : { accelerator: item.accelerator, registerAccelerator: UNDO_REDO.includes(item.id) }),
    click: () => renderer?.run(item.id),
  }));
}

/** Edit's Undo and Redo: the editor's when it has them, else the roles (the start screen). */
function undoRedo(edit: readonly MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
  const [undo, redo] = UNDO_REDO.map((id) => edit.find((item) => item.id === id));
  return [undo ?? { role: "undo" }, redo ?? { role: "redo" }];
}

/** A menu of `items` after a separator, or nothing when there are none. */
const after = (items: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] =>
  items.length === 0 ? [] : [{ type: "separator" }, ...items];

/**
 * The application menu (F-ED-27). The editor draws its own menus (1.2) and handles its own keys, so
 * Electron's default menu would take keys it uses: its View menu zooms the whole window on
 * Ctrl/Cmd + =, − and 0 (the canvas's zoom keys) and reloads it on Ctrl/Cmd + R. Windows and Linux
 * get no menu. macOS keeps what a Mac app needs from its menu bar: the app menu (About, Hide,
 * Quit), Edit's roles (which give text fields Cmd + C, V, X and A), a View menu and Window's.
 * View has no full-screen item of ours: macOS adds its own *Enter Full Screen* (⌃⌘F) to any menu
 * titled View, so a `togglefullscreen` role showed a second one beside it (#525);
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
    const appItems = itemsOf(renderer, "app");
    const file = itemsOf(renderer, "file");
    const edit = itemsOf(renderer, "edit");
    const view = itemsOf(renderer, "view");
    const help = itemsOf(renderer, "help");
    return [
      // The application menu, with the editor's own items (Settings…, LF-12) after About.
      appItems.length === 0
        ? { role: "appMenu" }
        : {
            // A Mac's first menu is the app's, whatever its label; a role's own submenu can't
            // take items.
            label: t("app.name"),
            submenu: [
              { role: "about" },
              { type: "separator" },
              ...appItems,
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
      ...(file.length === 0 ? [] : [{ label: t("shell.menu.file"), submenu: file }]),
      renderer === undefined
        ? { role: "editMenu" }
        : {
            label: t("shell.menu.edit"),
            submenu: [
              ...undoRedo(edit),
              { type: "separator" },
              { role: "cut" },
              { role: "copy" },
              { role: "paste" },
              { role: "selectAll" },
              ...after(edit.filter((item) => !UNDO_REDO.includes(item.id ?? ""))),
            ],
          },
      // Always there, empty on the start screen: macOS adds Enter Full Screen to it (#525).
      { label: t("app.menu.view"), submenu: view },
      ...developer,
      { role: "windowMenu" },
      ...(help.length === 0 ? [] : [{ role: "help" as const, submenu: help }]),
    ];
  }
  return developer.length === 0 ? null : developer;
}
