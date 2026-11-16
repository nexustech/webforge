import type { Command } from "./commands.js";

/** Why `command` is disabled, while it is and its owner says (#1010). */
export const reasonOf = (command: Command): string | undefined =>
  command.enabled === false ? command.disabledReason : undefined;

/**
 * A menu or command box row's props for `command`'s reason, while it shows one (#1010): two lines
 * tall, not one (`menuStyles.row` is 24 px), and described by the reason, which is read after its
 * name.
 */
export function reasonRowProps(command: Command): {
  readonly className?: string;
  readonly "aria-description"?: string;
} {
  const reason = reasonOf(command);
  return reason === undefined
    ? {}
    : { className: "h-auto min-h-6 py-0.5", "aria-description": reason };
}

/**
 * A command's name in a menu or the command box, with why it's disabled under it while it is
 * (#1010): "Undo", then "Nothing to undo." The row is described by the reason
 * ({@link reasonRowProps}), so it isn't part of the row's name.
 */
export function CommandLabel({
  command,
  label,
}: {
  readonly command: Command;
  /** Its name here, when not its label: the command box's `paletteLabel`. */
  readonly label?: string;
}) {
  const name = label ?? command.label;
  const reason = reasonOf(command);
  if (reason === undefined) return name;
  return (
    <span className="flex min-w-0 flex-col">
      <span>{name}</span>
      <span className="text-xs" aria-hidden>
        {reason}
      </span>
    </span>
  );
}
