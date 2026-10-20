import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useCommandRegistry, useCommands } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";
import { formatShortcut } from "./commands.js";

/** Opens the box. */
const COMMAND_BOX_SHORTCUT = "Mod+K";

/** Props of {@link CommandBox}. */
export type CommandBoxProps = {
  /** Shown in the box while closed, like a document title (UI1). */
  readonly siteName: string;
};

/**
 * The title bar's central box: shows the site's name and opens a searchable list of every
 * enabled command (Ctrl/Cmd+K). Choosing one closes the box and runs it.
 */
export function CommandBox({ siteName }: CommandBoxProps) {
  const registry = useCommandRegistry();
  const commands = useCommands();
  const [open, setOpen] = useState(false);

  useEffect(
    () =>
      registry.register({
        id: COMMAND_IDS.commandBox,
        label: t("command.commandBox"),
        menu: "view",
        shortcut: COMMAND_BOX_SHORTCUT,
        run: () => setOpen(true),
      }),
    [registry],
  );

  const runnable = commands.filter(
    (command) => command.id !== COMMAND_IDS.commandBox && command.enabled !== false,
  );

  return (
    <>
      <button
        type="button"
        className="flex h-7 w-full max-w-md min-w-40 items-center gap-2 rounded-md bg-input px-2 text-sm outline-none hover:bg-input/80 focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t("shell.commandBox.open")}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-left">{siteName}</span>
        <kbd className="font-sans text-xs text-muted-foreground">
          {formatShortcut(COMMAND_BOX_SHORTCUT)}
        </kbd>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showClose={false} className="top-24 translate-y-0 gap-0 p-0 sm:max-w-lg">
          <DialogTitle className="sr-only">{t("shell.commandBox.title")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("shell.commandBox.description")}
          </DialogDescription>
          <Command label={t("shell.commandBox.title")}>
            <CommandInput placeholder={t("shell.commandBox.placeholder")} />
            <CommandList>
              <CommandEmpty>{t("shell.commandBox.empty")}</CommandEmpty>
              {runnable.map((command) => (
                <CommandItem
                  key={command.id}
                  value={`${command.label} ${command.id}`}
                  onSelect={() => {
                    setOpen(false);
                    registry.run(command.id);
                  }}
                >
                  {command.label}
                  {command.shortcut !== undefined && (
                    <CommandShortcut>{formatShortcut(command.shortcut)}</CommandShortcut>
                  )}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
