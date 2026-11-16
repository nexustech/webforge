import {
  Button,
  type ButtonProps,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { ChevronDownIcon } from "lucide-react";
import type { ReactNode } from "react";
import { CommandLabel, reasonOf, reasonRowProps, tipWithReason } from "./CommandLabel.js";
import { useCommandRegistry, useCommands } from "./command-context.js";
import { type Command, formatShortcut } from "./commands.js";

/** Props of {@link CommandButton}. */
export type CommandButtonProps = {
  readonly commandId: string;
  readonly icon: ReactNode;
  /** A short visible label ("Export"); without it the button shows only its icon. */
  readonly text?: string;
  /** An icon-only button's name until its command is registered (then the command's label). */
  readonly label?: string;
  readonly className?: string;
  readonly size?: ButtonProps["size"];
};

/**
 * A title-bar button for a registered command. Its tooltip gives the command's full label and
 * shortcut, and while it's disabled why (#1010): the command's reason, or "Open a site first" while
 * the command is missing (not contributed yet, as on the start screen). Commands that name it as
 * theirs to go with (`more`) make it a split button, with a caret that lists them.
 */
export function CommandButton({
  commandId,
  icon,
  text,
  label,
  className,
  size,
}: CommandButtonProps) {
  const registry = useCommandRegistry();
  const commands = useCommands();
  const command = commands.find((each) => each.id === commandId);
  const more = commands.filter((each) => each.more === commandId);
  const disabled = command === undefined || command.enabled === false;
  const name = command?.label ?? label;
  const tip =
    command === undefined
      ? (text ?? label)
      : command.shortcut === undefined
        ? (command.tooltip ?? command.label)
        : `${command.tooltip ?? command.label} (${formatShortcut(command.shortcut)})`;
  const reason = command === undefined ? t("shell.disabled.noSite") : reasonOf(command);

  // Always some text (a missing command has its reason), so the button keeps its tooltip, and
  // `disabled` is always given: neither comes and goes, which would remount it.
  const button = (
    <Button
      variant="ghost"
      size={size ?? (text === undefined ? "icon" : "default")}
      className={cn("[&_svg]:transition-colors", className)}
      disabled={disabled}
      tooltip={tipWithReason(tip, reason)}
      // Found by the tour, which points at it (OB-3).
      data-command={commandId}
      aria-label={text === undefined ? name : undefined}
      onClick={() => registry.run(commandId)}
    >
      {icon}
      {text}
    </Button>
  );
  if (more.length === 0) {
    return button;
  }
  return (
    <span className="inline-flex">
      {button}
      <MoreMenu name={label ?? text ?? name ?? commandId} commands={more} />
    </span>
  );
}

/** A split button's caret: the commands that go with the button (LF-13). */
function MoreMenu({
  name,
  commands,
}: {
  readonly name: string;
  readonly commands: readonly Command[];
}) {
  const registry = useCommandRegistry();
  return (
    // Not modal, as Undo's steps menu beside it: the title bar stays as it is behind it.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="w-4"
          aria-label={t("shell.moreOptions", { name })}
        >
          <ChevronDownIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {commands.map((command) => (
          <DropdownMenuItem
            key={command.id}
            disabled={command.enabled === false}
            {...reasonRowProps(command)}
            onSelect={() => void registry.run(command.id)}
          >
            <CommandLabel command={command} />
            {command.shortcut === undefined ? null : (
              <DropdownMenuShortcut>{formatShortcut(command.shortcut)}</DropdownMenuShortcut>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
