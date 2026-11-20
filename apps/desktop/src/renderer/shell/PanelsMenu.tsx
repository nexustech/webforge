import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { PanelsTopLeftIcon } from "lucide-react";
import { useCommandRegistry, useCommands } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";
import { formatShortcut } from "./commands.js";

/** The panels the menu shows or hides, by their commands, with each one's name in the menu. */
const PANELS = [
  { id: COMMAND_IDS.toggleLeftPanels, label: "shell.panelsMenu.left" },
  { id: COMMAND_IDS.toggleDrawer, label: "shell.panelsMenu.bottom" },
  { id: COMMAND_IDS.toggleRightPanels, label: "shell.panelsMenu.right" },
] as const;

/**
 * The title bar's three panel buttons as one menu, for a title bar too narrow for them (#1195):
 * each column and the bottom panel as a checkbox, ticked while it's shown, with its shortcut. It
 * runs the same commands the buttons do. Nothing while none of them is registered.
 */
export function PanelsMenu({ className }: { readonly className?: string }) {
  const registry = useCommandRegistry();
  const commands = useCommands();
  const panels = PANELS.flatMap(({ id, label }) => {
    const command = commands.find((each) => each.id === id);
    return command === undefined ? [] : [{ command, label }];
  });
  if (panels.length === 0) return null;
  return (
    // Not modal, as the title bar's other menus: the editor stays as it is behind it.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={className}
          aria-label={t("shell.panelsMenu")}
          tooltip={t("shell.panelsMenu")}
        >
          <PanelsTopLeftIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {panels.map(({ command, label }) => (
          <DropdownMenuCheckboxItem
            key={command.id}
            checked={command.checked === true}
            disabled={command.enabled === false}
            onCheckedChange={() => void registry.run(command.id)}
          >
            {t(label)}
            {command.shortcut === undefined ? null : (
              <DropdownMenuShortcut>{formatShortcut(command.shortcut)}</DropdownMenuShortcut>
            )}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
