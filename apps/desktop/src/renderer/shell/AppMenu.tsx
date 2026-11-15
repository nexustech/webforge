import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { Fragment } from "react";
import { CommandLabel, reasonRowProps } from "./CommandLabel.js";
import { useCommandRegistry, useCommands } from "./command-context.js";
import { type Command, formatShortcut, type MenuId, menuEntries } from "./commands.js";

const MENUS: readonly MenuId[] = ["file", "edit", "view", "help"];

const MENU_LABELS = {
  file: "shell.menu.file",
  edit: "shell.menu.edit",
  view: "shell.menu.view",
  help: "shell.menu.help",
} as const;

/**
 * The title bar's app menu (File, Edit, View, Help), listing the registered commands; an item
 * can open a submenu (File › Open Recent, 3.18), which the arrow keys open and leave. A disabled
 * item says why under its name, when its command does (#1010).
 */
export function AppMenu() {
  const registry = useCommandRegistry();
  const commands = useCommands();

  const item = (command: Command) => (
    <MenubarItem
      key={command.id}
      disabled={command.enabled === false}
      {...reasonRowProps(command)}
      onSelect={() => registry.run(command.id)}
    >
      <CommandLabel command={command} />
      {command.shortcut !== undefined && (
        <MenubarShortcut>{formatShortcut(command.shortcut)}</MenubarShortcut>
      )}
    </MenubarItem>
  );

  return (
    <Menubar aria-label={t("shell.menu")}>
      {MENUS.map((menu) => {
        const entries = menuEntries(commands, (command) => command.menu === menu);
        if (entries.length === 0) {
          return null;
        }
        return (
          <MenubarMenu key={menu} value={menu}>
            <MenubarTrigger>{t(MENU_LABELS[menu])}</MenubarTrigger>
            <MenubarContent>
              {entries.map(({ command, submenu }) =>
                submenu.length === 0 ? (
                  item(command)
                ) : (
                  <MenubarSub key={command.id}>
                    <MenubarSubTrigger
                      disabled={command.enabled === false}
                      {...reasonRowProps(command)}
                    >
                      <CommandLabel command={command} />
                    </MenubarSubTrigger>
                    <MenubarSubContent>
                      {submenu.map((each) => (
                        <Fragment key={each.id}>
                          {each.separated === true && <MenubarSeparator />}
                          {item(each)}
                        </Fragment>
                      ))}
                    </MenubarSubContent>
                  </MenubarSub>
                ),
              )}
            </MenubarContent>
          </MenubarMenu>
        );
      })}
    </Menubar>
  );
}
