import { t } from "@webforge/i18n";
import type { AppApi, NativeMenus } from "../../shared/ipc/app.js";
import { COMMAND_IDS } from "./command-ids.js";
import {
  type CommandRegistry,
  electronAccelerator,
  hasModalOpen,
  type MenuId,
} from "./commands.js";

/**
 * Commands a Mac lists in its application menu (Webforge › Settings…, LF-12), whatever their
 * menu in the window's own menus elsewhere.
 */
const APP_MENU: ReadonlySet<string> = new Set([COMMAND_IDS.settings]);

/** The menus, in the menu bar's order, and their names. */
const MENUS: readonly {
  readonly id: MenuId | "app";
  readonly label: () => string;
}[] = [
  { id: "app", label: () => t("app.name") },
  { id: "file", label: () => t("shell.menu.file") },
  { id: "edit", label: () => t("shell.menu.edit") },
  { id: "view", label: () => t("shell.menu.view") },
  { id: "help", label: () => t("shell.menu.help") },
];

/** The registry's menus as macOS's menu bar shows them: each menu's commands, with their keys. */
export function nativeMenusOf(registry: Pick<CommandRegistry, "list">): NativeMenus {
  const commands = registry.list();
  return MENUS.map(({ id, label }) => ({
    id,
    label: label(),
    items: commands
      .filter((command) =>
        id === "app" ? APP_MENU.has(command.id) : command.menu === id && !APP_MENU.has(command.id),
      )
      .map((command) => ({
        id: command.id,
        label: command.label,
        enabled: command.enabled !== false,
        ...(command.shortcut === undefined
          ? {}
          : { accelerator: electronAccelerator(command.shortcut) }),
      })),
  })).filter((menu) => menu.items.length > 0);
}

/** The editor's Undo and Redo, which are the text's own in a dialog. */
const TEXT_EDITS: Readonly<Record<string, "undo" | "redo">> = {
  [COMMAND_IDS.undo]: "undo",
  [COMMAND_IDS.redo]: "redo",
};

/** The editor window's document, as a command chosen in the menu bar needs it. */
type MenuDocument = Pick<Document, "querySelector" | "execCommand">;

/**
 * Runs command `id`, chosen in the menu bar or by its keys there. Not while a dialog or a menu has
 * the keys, as the window's own menus can't be reached then; Undo and Redo are the dialog's text's
 * there (a Cmd+Z the editor leaves to a dialog reaches the menu bar, which has no Undo role).
 */
function runFromMenuBar(registry: Pick<CommandRegistry, "run">, id: string, doc: MenuDocument) {
  if (!hasModalOpen(doc)) {
    registry.run(id);
    return;
  }
  const edit = TEXT_EDITS[id];
  if (edit !== undefined) doc.execCommand(edit);
}

/**
 * Shows the registry's menus in macOS's menu bar (LF-13), again whenever its commands change, and
 * runs a command chosen there. Changes in a burst (a selection changing what's enabled) are sent
 * once, and the same menus aren't sent twice. Returns a function that stops.
 */
export function syncNativeMenus(
  registry: Pick<CommandRegistry, "list" | "run" | "subscribe">,
  app: Pick<AppApi, "setNativeMenus" | "onRunCommand">,
  doc: MenuDocument = globalThis.document,
): () => void {
  let sent = "";
  let pending: ReturnType<typeof setTimeout> | undefined;
  const send = () => {
    pending = undefined;
    const menus = nativeMenusOf(registry);
    const key = JSON.stringify(menus);
    if (key === sent) return;
    sent = key;
    void app.setNativeMenus(menus).catch(() => undefined);
  };
  const schedule = () => {
    if (pending === undefined) pending = setTimeout(send, 50);
  };
  send();
  const stopListening = registry.subscribe(schedule);
  const stopRunning = app.onRunCommand((id) => runFromMenuBar(registry, id, doc));
  return () => {
    stopListening();
    stopRunning();
    if (pending !== undefined) clearTimeout(pending);
  };
}
