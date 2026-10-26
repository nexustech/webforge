import { useCommandRegistry, useCommands } from "../shell/command-context.js";
import { HELP_ITEMS } from "./help-items.js";

/**
 * The start screen's Help tab (2.14b, LF-10): an entry for each {@link HELP_ITEMS} command that is
 * registered, with its name and what it is for. Choosing one runs it.
 */
export function StartHelp() {
  const registry = useCommandRegistry();
  const commands = useCommands();
  const items = HELP_ITEMS.flatMap((item) => {
    const command = commands.find((each) => each.id === item.command);
    return command === undefined ? [] : [{ ...item, label: command.label }];
  });
  return (
    <ul className="m-0 flex max-w-xl list-none flex-col gap-2 p-0">
      {items.map((item) => (
        <li key={item.command}>
          <button
            type="button"
            className="flex w-full flex-col gap-0.5 rounded-md border border-border bg-panel p-3 text-left hover:border-border-strong focus-visible:outline-2 focus-visible:outline-ring"
            onClick={() => registry.run(item.command)}
          >
            <span className="text-sm font-medium">{item.label}</span>
            <span className="text-xs text-muted-foreground">{item.description()}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
