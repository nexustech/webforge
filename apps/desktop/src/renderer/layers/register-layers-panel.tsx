import { toast } from "@webforge/editor-ui";
import type { ReadonlyStore } from "@webforge/history";
import { t } from "@webforge/i18n";
import { sameJson } from "@webforge/model";
import { LayersIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import type { CanvasPointer } from "../editor/canvas-pointer.js";
import type { EditorSession } from "../editor/editor-session.js";
import {
  copyLayer,
  type Layer,
  moveLayer,
  pageLayers,
  renameLayer,
  setLayerHidden,
} from "../editor/layers.js";
import { useUi } from "../editor/use-document.js";
import { ElementMenu } from "../element-menu/index.js";
import { useCommand, useCommandRegistry } from "../shell/command-context.js";
import type { PanelRegistry } from "../shell/panels.js";
import {
  createPreferencesStore,
  type EditorPreferences,
  usePreferences,
} from "../shell/preferences-store.js";
import { LayersPanel } from "./LayersPanel.js";

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
 * Where `index` among a page's top-level rows (the shared Header's first, then the page's sections,
 * then the Footer's) falls in the list the top-level layer `id` is in: the Header's, the page's own
 * or the Footer's (#673). `index` itself for a layer inside another.
 */
function listIndex(layers: readonly Layer[], id: string, index: number): number {
  const top = layers.find((layer) => layer.id === id);
  if (top === undefined || top.region === "header") return index;
  const before =
    top.region === "footer"
      ? layers.filter((layer) => layer.region !== "footer").length
      : layers.filter((layer) => layer.region === "header").length;
  return index - before;
}

/**
 * Adds Layers to the left column's bottom, before Undo History (UI1), in Advanced mode only (T2).
 * The tree follows the shown page and the selection, the shared Header first and the Footer last
 * (#673); it is rebuilt only when the page's structure or names change, not on every keystroke. A linked copy's layer is selected while the copy is,
 * not an element inside it: Layers' actions act on what is selected (F-ED-23). In Content mode
 * (M3, from `preferences`) nothing can be dragged, moved or hidden; the panel follows the mode
 * without being registered again, so what it shows (collapsed layers, the filter) stays (R9).
 * Returns a function that removes the panel.
 */
export function registerLayersPanel(
  panels: PanelRegistry,
  session: EditorSession,
  {
    preferences = createPreferencesStore(),
    canvas,
  }: {
    readonly preferences?: ReadonlyStore<EditorPreferences>;
    /** The canvas the rows point at (SP-8, SP-10); nothing is shown there without it. */
    readonly canvas?: CanvasPointer;
  } = {},
): () => void {
  const { history, ui, library } = session;
  // The tree as last shown, for the page (its content and settings), the shared sections and the
  // Header and Footer it was made from: rebuilt only when they change, and kept (same object) when
  // the rebuilt tree is the same, e.g. after typing.
  let shown: { page: unknown; shared: unknown; layout: unknown; layers: Layer[] } = {
    page: undefined,
    shared: undefined,
    layout: undefined,
    layers: [],
  };
  const currentLayers = () => {
    const site = history.document.getState();
    const { pageId } = ui.getState();
    const page = site.pages[pageId];
    const shared = site.sharedSections;
    const layout = site.layout;
    if (page === shown.page && shared === shown.shared && layout === shown.layout) {
      return shown.layers;
    }
    const layers = page === undefined ? [] : pageLayers(site, pageId, library);
    shown = sameJson(layers, shown.layers)
      ? { ...shown, page, shared, layout }
      : { page, shared, layout, layers };
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
    const layoutLocked = usePreferences(preferences, (state) => state.mode !== "design");
    return (
      <LayersPanel
        layers={layers}
        selectedId={selectedId}
        alsoSelected={alsoSelected}
        layoutLocked={layoutLocked}
        menu={ElementMenu}
        canvas={canvas}
        actions={{
          select: (id) => session.select(id),
          toggle: (id) => session.toggleSelected(id),
          selectMany: (ids) => session.selectElements(ids),
          rename: (id, name) => renameLayer(session, id, name),
          setHidden: (id, hidden) => setLayerHidden(session, id, hidden),
          // A dragged layer moves or is copied alone, and is selected alone after: the panel
          // never drags a row of several selected (those move with the Edit menu's moves, 1.31).
          // A page's own section counts among the page's sections, not the Header (#673).
          move: (id, index) => moveLayer(session, id, listIndex(layers, id, index)),
          copy: (id, index, linked) => {
            // Refused, it says why, as duplicate does.
            const refused = copyLayer(session, id, listIndex(layers, id, index), linked);
            if (refused !== undefined) toast(refused);
          },
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
