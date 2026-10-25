import {
  Button,
  type ButtonProps,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { ChevronDownIcon } from "lucide-react";
import type { ReactNode } from "react";
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
 * shortcut. Disabled while the command is missing (not contributed yet) or disabled. Commands that
 * name it as theirs to go with (`more`) make it a split button, with a caret that lists them.
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
        ? command.label
        : `${command.label} (${formatShortcut(command.shortcut)})`;

  const button = (
    <Button
      variant="ghost"
      size={size ?? (text === undefined ? "icon" : "default")}
      // A disabled button mutes its colour-coded icon too.
      className={cn("[&_svg]:transition-colors [&:disabled_svg]:text-disabled", className)}
      disabled={disabled}
      aria-label={text === undefined ? name : undefined}
      onClick={() => registry.run(commandId)}
    >
      {icon}
      {text}
    </Button>
  );
  const withTip =
    tip === undefined ? (
      button
    ) : (
      <Tooltip>
        {/* A disabled button gets no pointer events, so the tooltip hangs on a wrapper. */}
        <TooltipTrigger asChild>
          <span className="inline-flex">{button}</span>
        </TooltipTrigger>
        <TooltipContent>{tip}</TooltipContent>
      </Tooltip>
    );
  if (more.length === 0) {
    return withTip;
  }
  return (
    <span className="inline-flex">
      {withTip}
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
    <DropdownMenu>
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
            onSelect={() => void registry.run(command.id)}
          >
            {command.label}
            {command.shortcut === undefined ? null : (
              <DropdownMenuShortcut>{formatShortcut(command.shortcut)}</DropdownMenuShortcut>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
