import { t } from "@webforge/i18n";
import { useSyncExternalStore } from "react";
import type { EditorSession } from "../editor/editor-session.js";
import { useCommand, useCommandRegistry } from "../shell/command-context.js";
import type { PanelRegistry } from "../shell/panels.js";
import { LayersPanel } from "./LayersPanel.js";
import { type Layer, layersOf, moveLayer, renameLayer, setLayerHidden } from "./layers.js";

/** The canvas commands the Layers toolbar runs on the selected element (1.12). */
const TOOLBAR_COMMANDS = {
  moveUp: "edit.moveUp",
  moveDown: "edit.moveDown",
  duplicate: "edit.duplicate",
  remove: "edit.delete",
} as const;

/** A command as a toolbar action: undefined while it is missing or disabled. */
function useCommandAction(id: string): (() => void) | undefined {
  const registry = useCommandRegistry();
  const command = useCommand(id);
  return command === undefined || command.enabled === false ? undefined : () => registry.run(id);
}

/**
 * Adds Layers to the left column's bottom, before Undo History (UI1), in Advanced mode only (T2).
 * The tree follows the shown page and the selection; it is rebuilt only when the page's structure
 * or names change, not on every keystroke. Returns a function that removes the panel.
 */
export function registerLayersPanel(panels: PanelRegistry, session: EditorSession): () => void {
  const { history, ui, library } = session;
  let shown: { key: string; layers: Layer[] } = { key: "", layers: [] };
  const currentLayers = () => {
    const page = history.document.getState().pages[ui.getState().pageId]?.doc;
    const layers = page === undefined ? [] : layersOf(page.content, library);
    const key = JSON.stringify(layers);
    if (key !== shown.key) {
      shown = { key, layers };
    }
    return shown.layers;
  };
  const subscribe = (listener: () => void) => {
    const stopDocument = history.document.subscribe(listener);
    const stopUi = ui.subscribe(listener);
    return () => {
      stopDocument();
      stopUi();
    };
  };

  function Layers() {
    const layers = useSyncExternalStore(subscribe, currentLayers, currentLayers);
    const selectedId = useSyncExternalStore(
      ui.subscribe,
      () => ui.getState().nodeId,
      () => ui.getState().nodeId,
    );
    return (
      <LayersPanel
        layers={layers}
        selectedId={selectedId}
        actions={{
          select: (id) => ui.setState({ nodeId: id }),
          rename: (id, name) => renameLayer(session, id, name),
          setHidden: (id, hidden) => setLayerHidden(session, id, hidden),
          move: (id, index) => moveLayer(session, id, index),
          moveUp: useCommandAction(TOOLBAR_COMMANDS.moveUp),
          moveDown: useCommandAction(TOOLBAR_COMMANDS.moveDown),
          duplicate: useCommandAction(TOOLBAR_COMMANDS.duplicate),
          remove: useCommandAction(TOOLBAR_COMMANDS.remove),
        }}
      />
    );
  }

  return panels.register({
    id: "layers",
    slot: "left.bottom",
    title: t("layers.title"),
    advancedOnly: true,
    order: -1,
    component: Layers,
  });
}
