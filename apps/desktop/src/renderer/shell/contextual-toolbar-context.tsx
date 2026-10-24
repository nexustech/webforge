import { createContext, type ReactNode, useContext, useSyncExternalStore } from "react";
import type { ContextualToolbar, ContextualToolbarRegistry } from "./contextual-toolbars.js";

const ContextualToolbarsContext = createContext<ContextualToolbarRegistry | null>(null);

/** Makes `registry` available to the canvas toolbar and to every area that adds toolbars. */
export function ContextualToolbarsProvider({
  registry,
  children,
}: {
  readonly registry: ContextualToolbarRegistry;
  readonly children: ReactNode;
}) {
  return <ContextualToolbarsContext value={registry}>{children}</ContextualToolbarsContext>;
}

/** The window's contextual toolbar registry (SP-4). */
export function useContextualToolbars(): ContextualToolbarRegistry {
  const registry = useContext(ContextualToolbarsContext);
  if (registry === null) {
    throw new Error("useContextualToolbars needs a ContextualToolbarsProvider");
  }
  return registry;
}

/** The toolbar for elements of `type` (none for no type); redraws when toolbars are added. */
export function useContextualToolbar(type: string | undefined): ContextualToolbar | undefined {
  const registry = useContextualToolbars();
  useSyncExternalStore(registry.subscribe, registry.list, registry.list);
  return type === undefined ? undefined : registry.forType(type);
}
