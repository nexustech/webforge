import { t } from "@webforge/i18n";
import type { AppApi, NativeMenus } from "../../shared/ipc/app.js";
import { type CommandRegistry, electronAccelerator, type MenuId } from "./commands.js";

/** The menus, in the menu bar's order, and their names. */
const MENUS: readonly { readonly id: MenuId; readonly label: () => string }[] = [
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
      .filter((command) => command.menu === id)
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

/**
 * Shows the registry's menus in macOS's menu bar (LF-13), again whenever its commands change, and
 * runs a command chosen there. Changes in a burst (a selection changing what's enabled) are sent
 * once, and the same menus aren't sent twice. Returns a function that stops.
 */
export function syncNativeMenus(
  registry: Pick<CommandRegistry, "list" | "run" | "subscribe">,
  app: Pick<AppApi, "setNativeMenus" | "onRunCommand">,
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
  const stopRunning = app.onRunCommand((id) => registry.run(id));
  return () => {
    stopListening();
    stopRunning();
    if (pending !== undefined) clearTimeout(pending);
  };
}
