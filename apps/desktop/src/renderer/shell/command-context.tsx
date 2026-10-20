import { createContext, type ReactNode, useContext, useSyncExternalStore } from "react";
import type { Command, CommandRegistry } from "./commands.js";

const CommandRegistryContext = createContext<CommandRegistry | null>(null);

/** Makes `registry` available to the shell and to every area that adds commands. */
export function CommandRegistryProvider({
  registry,
  children,
}: {
  readonly registry: CommandRegistry;
  readonly children: ReactNode;
}) {
  return <CommandRegistryContext value={registry}>{children}</CommandRegistryContext>;
}

/** The window's command registry. */
export function useCommandRegistry(): CommandRegistry {
  const registry = useContext(CommandRegistryContext);
  if (registry === null) {
    throw new Error("useCommandRegistry needs a CommandRegistryProvider");
  }
  return registry;
}

/** The registered commands; re-renders when they change. */
export function useCommands(): readonly Command[] {
  const registry = useCommandRegistry();
  return useSyncExternalStore(registry.subscribe, registry.list, registry.list);
}

/** One registered command, or undefined; re-renders when it changes. */
export function useCommand(id: string): Command | undefined {
  return useCommands().find((command) => command.id === id);
}
