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
  /**
   * With `text`: shown only while the title bar (its container, `title-bar`) is at least 1180 px
   * wide, icon only below that, the button still named by it (#1009). Windows 1280 px wide and up
   * always show it; at 960 px nothing is cut off.
   */
  readonly textWhenWide?: boolean;
  readonly className?: string;
  readonly size?: ButtonProps["size"];
  /** Ghost unless given: Publish is the title bar's one filled button (#1009). */
  readonly variant?: ButtonProps["variant"];
};

/**
 * A title-bar button for a registered command. Its tooltip gives the command's full label and
 * shortcut, and while it's disabled why (#1010). Nothing while the command is missing (not
 * contributed yet, as Undo and Publish aren't on the start screen, #1009). Commands that name it
 * as theirs to go with (`more`) make it a split button, with a caret that lists them.
 */
export function CommandButton({
  commandId,
  icon,
  text,
  textWhenWide = false,
  className,
  size,
  variant = "ghost",
}: CommandButtonProps) {
  const registry = useCommandRegistry();
  const commands = useCommands();
  const command = commands.find((each) => each.id === commandId);
  const more = commands.filter((each) => each.more === commandId);
  if (command === undefined) return null;
  const tip =
    command.shortcut === undefined
      ? (command.tooltip ?? command.label)
      : `${command.tooltip ?? command.label} (${formatShortcut(command.shortcut)})`;
  const collapses = text !== undefined && textWhenWide;

  // `disabled` is always given, so it doesn't come and go, which would remount the button.
  const button = (
    <Button
      variant={variant}
      size={size ?? (text === undefined || collapses ? "icon" : "default")}
      className={cn(
        "[&_svg]:transition-colors",
        // Written out in full: Tailwind finds its classes in the source as they are.
        collapses && "@min-[1180px]/title-bar:w-auto @min-[1180px]/title-bar:px-2.5",
        className,
      )}
      disabled={command.enabled === false}
      tooltip={tipWithReason(tip, reasonOf(command))}
      // Found by the tour, which points at it (OB-3).
      data-command={commandId}
      aria-label={text === undefined ? command.label : collapses ? text : undefined}
      onClick={() => registry.run(commandId)}
    >
      {icon}
      {collapses ? <span className="hidden @min-[1180px]/title-bar:inline">{text}</span> : text}
    </Button>
  );
  if (more.length === 0) {
    return button;
  }
  return (
    <span className="inline-flex">
      {button}
      <MoreMenu name={text ?? command.label} commands={more} />
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
