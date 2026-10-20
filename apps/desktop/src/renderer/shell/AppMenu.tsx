import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarShortcut,
  MenubarTrigger,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useCommandRegistry, useCommands } from "./command-context.js";
import { formatShortcut, type MenuId } from "./commands.js";

const MENUS: readonly MenuId[] = ["file", "edit", "view", "help"];

const MENU_LABELS = {
  file: "shell.menu.file",
  edit: "shell.menu.edit",
  view: "shell.menu.view",
  help: "shell.menu.help",
} as const;

/** The title bar's app menu (File, Edit, View, Help), listing the registered commands. */
export function AppMenu() {
  const registry = useCommandRegistry();
  const commands = useCommands();

  return (
    <Menubar aria-label={t("shell.menu")}>
      {MENUS.map((menu) => {
        const items = commands.filter((command) => command.menu === menu);
        if (items.length === 0) {
          return null;
        }
        return (
          <MenubarMenu key={menu} value={menu}>
            <MenubarTrigger>{t(MENU_LABELS[menu])}</MenubarTrigger>
            <MenubarContent>
              {items.map((command) => (
                <MenubarItem
                  key={command.id}
                  disabled={command.enabled === false}
                  onSelect={() => registry.run(command.id)}
                >
                  {command.label}
                  {command.shortcut !== undefined && (
                    <MenubarShortcut>{formatShortcut(command.shortcut)}</MenubarShortcut>
                  )}
                </MenubarItem>
              ))}
            </MenubarContent>
          </MenubarMenu>
        );
      })}
    </Menubar>
  );
}
