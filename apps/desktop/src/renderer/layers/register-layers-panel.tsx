import { t } from "@webforge/i18n";
import { LayersIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import type { EditorSession } from "../editor/editor-session.js";
import { sameValue } from "../editor/same-value.js";
import { useUi } from "../editor/use-document.js";
import { ElementMenu } from "../element-menu/ElementMenu.js";
import { useCommand, useCommandRegistry } from "../shell/command-context.js";
import type { PanelRegistry } from "../shell/panels.js";
import { LayersPanel } from "./LayersPanel.js";
import {
  copyLayer,
  type Layer,
  layersOf,
  moveLayer,
  renameLayer,
  setLayerHidden,
} from "./layers.js";

/** No other selected layers. */
const NO_OTHERS: readonly string[] = [];

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
 * or names change, not on every keystroke. A linked copy's layer is selected while the copy is,
 * not an element inside it: Layers' actions act on what is selected (F-ED-23). With `layoutLocked` (Content mode, M3) nothing can be
 * dragged, moved or hidden. Returns a function that removes the panel.
 */
export function registerLayersPanel(
  panels: PanelRegistry,
  session: EditorSession,
  { layoutLocked = false }: { readonly layoutLocked?: boolean } = {},
): () => void {
  const { history, ui, library } = session;
  // The tree as last shown, for the page content and shared sections it was made from: rebuilt
  // only when they change, and kept (same object) when the rebuilt tree is the same, e.g. after
  // typing.
  let shown: { content: unknown; shared: unknown; layers: Layer[] } = {
    content: undefined,
    shared: undefined,
    layers: [],
  };
  const currentLayers = () => {
    const site = history.document.getState();
    const content = site.pages[ui.getState().pageId]?.doc.content;
    const shared = site.sharedSections;
    if (content === shown.content && shared === shown.shared) {
      return shown.layers;
    }
    const layers = content === undefined ? [] : layersOf(content, library, shared);
    shown = sameValue(layers, shown.layers)
      ? { ...shown, content, shared }
      : { content, shared, layers };
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
    const selectedId = useUi(session, (state) => state.nodeId);
    const alsoSelected = useUi(session, (state) => state.others ?? NO_OTHERS);
    return (
      <LayersPanel
        layers={layers}
        selectedId={selectedId}
        alsoSelected={alsoSelected}
        layoutLocked={layoutLocked}
        menu={ElementMenu}
        actions={{
          select: (id) => session.select(id),
          toggle: (id) => session.toggleSelected(id),
          selectMany: (ids) => session.selectElements(ids),
          rename: (id, name) => renameLayer(session, id, name),
          setHidden: (id, hidden) => setLayerHidden(session, id, hidden),
          // A dragged layer moves or is copied alone, and is selected alone after: the panel
          // never drags a row of several selected (those move with the Edit menu's moves, 1.31).
          move: (id, index) => moveLayer(session, id, index),
          copy: (id, index, linked) => copyLayer(session, id, index, linked),
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
    // Always shown, under Add and Undo History, in Simple and Advanced mode (ADR 0011).
    slot: "left.lower",
    title: t("layers.title"),
    icon: LayersIcon,
    component: Layers,
  });
}
