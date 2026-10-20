import { createContext, type ReactNode, useContext, useSyncExternalStore } from "react";
import type { Panel, PanelRegistry } from "./panels.js";

const PanelRegistryContext = createContext<PanelRegistry | null>(null);

/** Makes `registry` available to the layout and to every area that adds panels. */
export function PanelRegistryProvider({
  registry,
  children,
}: {
  readonly registry: PanelRegistry;
  readonly children: ReactNode;
}) {
  return <PanelRegistryContext value={registry}>{children}</PanelRegistryContext>;
}

/** The window's panel registry. */
export function usePanelRegistry(): PanelRegistry {
  const registry = useContext(PanelRegistryContext);
  if (registry === null) {
    throw new Error("usePanelRegistry needs a PanelRegistryProvider");
  }
  return registry;
}

/** The registered panels; re-renders when they change. */
export function usePanels(): readonly Panel[] {
  const registry = usePanelRegistry();
  return useSyncExternalStore(registry.subscribe, registry.list, registry.list);
}
