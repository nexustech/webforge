import {
  Button,
  type ButtonProps,
  cn,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@webforge/editor-ui";
import type { ReactNode } from "react";
import { useCommand, useCommandRegistry } from "./command-context.js";
import { formatShortcut } from "./commands.js";

/** Props of {@link CommandButton}. */
export type CommandButtonProps = {
  readonly commandId: string;
  readonly icon: ReactNode;
  /** A short visible label ("Export"); without it the button shows only its icon. */
  readonly text?: string;
  readonly className?: string;
  readonly size?: ButtonProps["size"];
};

/**
 * A title-bar button for a registered command. Its tooltip gives the command's full label and
 * shortcut. Disabled while the command is missing (not contributed yet) or disabled.
 */
export function CommandButton({ commandId, icon, text, className, size }: CommandButtonProps) {
  const registry = useCommandRegistry();
  const command = useCommand(commandId);
  const disabled = command === undefined || command.enabled === false;
  const tip =
    command === undefined
      ? text
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
      aria-label={text === undefined ? command?.label : undefined}
      onClick={() => registry.run(commandId)}
    >
      {icon}
      {text}
    </Button>
  );
  if (tip === undefined) {
    return button;
  }
  return (
    <Tooltip>
      {/* A disabled button gets no pointer events, so the tooltip hangs on a wrapper. */}
      <TooltipTrigger asChild>
        <span className="inline-flex">{button}</span>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}
