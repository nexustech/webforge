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
  WithTooltip,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { MenuIcon } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { CommandLabel, reasonRowProps } from "./CommandLabel.js";
import { useCommandRegistry, useCommands } from "./command-context.js";
import { type Command, formatShortcut, type MenuId, menuEntries } from "./commands.js";
import { inGroups } from "./menu-groups.js";

const MENUS: readonly MenuId[] = ["file", "edit", "view", "site", "help"];

const MENU_LABELS = {
  file: "shell.menu.file",
  edit: "shell.menu.edit",
  view: "shell.menu.view",
  site: "shell.menu.site",
  help: "shell.menu.help",
} as const;

/**
 * The title bar's app menu (File, Edit, View, Site, Help), listing the registered commands in
 * their groups, a separator between (#1016); an item can open a submenu (File › Open Recent,
 * 3.18), which the arrow keys open and leave. A disabled item says why under its name, when its
 * command does (#1010). While the title bar is narrower than 1280 px the menus' titles fold into
 * one Menu button, whose menu has them as submenus, in the same order and groups (#1166): there,
 * the words would leave no room for the search box, Site Check's count and Publish.
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

  // Each menu's title and what it lists, the empty ones left out.
  const menus = MENUS.flatMap((menu) => {
    const entries = inGroups(
      menu,
      menuEntries(commands, (command) => command.menu === menu),
    );
    if (entries.length === 0) return [];
    const content: ReactNode = entries.map(({ command, submenu, separated }) => (
      <Fragment key={command.id}>
        {separated && <MenubarSeparator />}
        {submenu.length === 0 ? (
          item(command)
        ) : (
          <MenubarSub>
            <MenubarSubTrigger disabled={command.enabled === false} {...reasonRowProps(command)}>
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
        )}
      </Fragment>
    ));
    return [{ menu, title: t(MENU_LABELS[menu]), content }];
  });

  return (
    <>
      {/* Written out in full: Tailwind finds its classes in the source as they are. */}
      <Menubar aria-label={t("shell.menu")} className="hidden @min-[1280px]/title-bar:flex">
        {menus.map(({ menu, title, content }) => (
          <MenubarMenu key={menu} value={menu}>
            <MenubarTrigger>{title}</MenubarTrigger>
            <MenubarContent>{content}</MenubarContent>
          </MenubarMenu>
        ))}
      </Menubar>
      <Menubar aria-label={t("shell.menu")} className="@min-[1280px]/title-bar:hidden">
        <MenubarMenu value="menu">
          <WithTooltip tooltip={t("shell.menu.folded.tooltip")}>
            <MenubarTrigger
              aria-label={t("shell.menu.folded")}
              className="size-6 justify-center px-0"
            >
              <MenuIcon aria-hidden className="size-4" />
            </MenubarTrigger>
          </WithTooltip>
          <MenubarContent>
            {menus.map(({ menu, title, content }) => (
              <MenubarSub key={menu}>
                <MenubarSubTrigger>{title}</MenubarSubTrigger>
                <MenubarSubContent>{content}</MenubarSubContent>
              </MenubarSub>
            ))}
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </>
  );
}
