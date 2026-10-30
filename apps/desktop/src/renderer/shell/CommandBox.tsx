import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  filterByKeywords,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useCommandRegistry, useCommands } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";
import {
  type Command as AppCommand,
  formatShortcut,
  type PaletteGroup,
  submenuOpeners,
} from "./commands.js";

/** The palette's groups, in order: the app's commands, pages to go to, things to add. */
const GROUPS = [
  { id: "commands", heading: "shell.commandBox.commands" },
  { id: "pages", heading: "shell.commandBox.pages" },
  { id: "add", heading: "shell.commandBox.add" },
] as const satisfies readonly { id: PaletteGroup | "commands"; heading: string }[];

/** Props of {@link CommandBox}. */
export type CommandBoxProps = {
  /** Shown in the box while closed, like a document title (UI1). */
  readonly siteName: string;
};

/**
 * The title bar's central box: shows the site's name and opens the command palette (Ctrl/Cmd+P,
 * F-ED-26, UX-11): every enabled command with its shortcut, the pages to go to, and the sections
 * and elements to add (those with nowhere to go shown off), found by fuzzy search. Choosing one
 * closes the palette and runs it.
 */
export function CommandBox({ siteName }: CommandBoxProps) {
  const registry = useCommandRegistry();
  const commands = useCommands();
  const [open, setOpen] = useState(false);
  // Its key (Mod+P, UX-11) comes from the shortcut standard, like every command's.
  const ownKey = commands.find((command) => command.id === COMMAND_IDS.commandBox)?.shortcut;

  useEffect(
    () =>
      registry.register({
        id: COMMAND_IDS.commandBox,
        label: t("command.commandBox"),
        menu: "view",
        run: () => setOpen(true),
      }),
    [registry],
  );

  // The app's own commands only when they can run; an Add with nowhere to go is shown, off. An
  // item that opens a submenu runs nothing: its submenu's commands are listed instead (3.18).
  const openers = submenuOpeners(commands);
  const shown = commands.filter(
    (command) =>
      command.id !== COMMAND_IDS.commandBox &&
      !openers.has(command.id) &&
      (command.palette === "add" || command.enabled !== false),
  );
  const inGroup = (group: PaletteGroup | "commands") =>
    shown.filter((command) => (command.palette ?? "commands") === group);
  const item = (command: AppCommand) => (
    <CommandItem
      key={command.id}
      value={command.id}
      keywords={[command.paletteLabel ?? command.label, ...(command.keywords ?? [])]}
      disabled={command.enabled === false}
      onSelect={() => {
        setOpen(false);
        registry.run(command.id);
      }}
    >
      {command.paletteLabel ?? command.label}
      {command.shortcut !== undefined && (
        <CommandShortcut>{formatShortcut(command.shortcut)}</CommandShortcut>
      )}
    </CommandItem>
  );

  return (
    <>
      <button
        type="button"
        className="flex h-7 w-full max-w-md min-w-40 items-center gap-2 rounded-md bg-input px-2 text-sm outline-none hover:bg-input/80 focus-visible:ring-2 focus-visible:ring-ring"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {/* Named by its content, so the name includes the visible site name (WCAG 2.5.3). */}
        <span className="sr-only">{t("shell.commandBox.open")}</span>
        <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-left">{siteName}</span>
        {ownKey !== undefined && (
          <kbd className="font-sans text-xs text-muted-foreground">{formatShortcut(ownKey)}</kbd>
        )}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showClose={false} className="top-24 translate-y-0 gap-0 p-0 sm:max-w-lg">
          <DialogTitle className="sr-only">{t("shell.commandBox.title")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("shell.commandBox.description")}
          </DialogDescription>
          <Command label={t("shell.commandBox.title")} filter={filterByKeywords}>
            <CommandInput placeholder={t("shell.commandBox.placeholder")} />
            <CommandList>
              <CommandEmpty>{t("shell.commandBox.empty")}</CommandEmpty>
              {GROUPS.map(({ id, heading }) => {
                const items = inGroup(id);
                return items.length === 0 ? null : (
                  <CommandGroup key={id} heading={t(heading)}>
                    {items.map(item)}
                  </CommandGroup>
                );
              })}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
