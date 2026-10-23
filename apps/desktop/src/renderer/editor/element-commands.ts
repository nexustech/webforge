import type { CanvasEngine } from "@webforge/engine";
import { t } from "@webforge/i18n";
import { type Layer, type LayersSession, shownLayer, toggleLayerHidden } from "../layers/layers.js";
import type { CommandRegistry } from "../shell/commands.js";

/**
 * *Hide or show* for the selected element (F-ED-27: Mod + /) in the Edit menu and the command
 * box, and what the canvas's quick actions ask of the app (F-ED-25): hiding or showing an element,
 * and the image picker for *Edit* on an image (`pickImage`). Hiding is Layers' own step ("Hid
 * Heading"), so it reads the same wherever it is done, and only a layer can be hidden: not an
 * element of the shared Header or Footer, nor one inside a linked copy. Content mode's lock (M3)
 * turns it off. *Rename…* (F2, 1.30) asks for a layer's name (`rename`), in Content mode too: names
 * aren't layout. Returns a function that removes them, and one that follows the lock.
 */
export function registerElementCommands(
  registry: CommandRegistry,
  session: LayersSession,
  engine: CanvasEngine,
  beforeAction: () => void,
  pickImage: (nodeId: string) => void,
  rename: (layer: Layer) => void,
): {
  readonly remove: () => void;
  readonly setLayoutLocked: (locked: boolean) => void;
} {
  let locked = false;
  /** Whether element `id` can be hidden or shown now. */
  // Not yet for several selected elements (1.31 part 2 hides them all as one step).
  const canHide = (id: string | null) =>
    !locked &&
    id !== null &&
    (session.ui.getState().others ?? []).length === 0 &&
    shownLayer(session, id) !== undefined;
  const hide = (id: string) => {
    if (!canHide(id)) return;
    beforeAction();
    toggleLayerHidden(session, id);
  };
  const removeCommand = registry.register({
    id: "edit.toggleHidden",
    label: t("canvas.toggleHidden"),
    menu: "edit",
    shortcut: "Mod+/",
    textShortcut: true,
    enabled: false,
    run: () => {
      const { nodeId } = session.ui.getState();
      if (nodeId !== null) hide(nodeId);
    },
  });
  // One element's name: off while several are selected (1.31).
  const selectedLayer = () => {
    const { nodeId, others = [] } = session.ui.getState();
    return nodeId === null || others.length > 0 ? undefined : shownLayer(session, nodeId);
  };
  const removeRename = registry.register({
    id: "edit.rename",
    label: t("canvas.rename"),
    menu: "edit",
    shortcut: "F2",
    enabled: false,
    run: () => {
      const layer = selectedLayer();
      if (layer !== undefined) rename(layer);
    },
  });
  const stopRequests = engine.onElementRequest((request) => {
    if (request.kind === "pickImage") pickImage(request.nodeId);
    else hide(request.nodeId);
  });
  const update = () => {
    registry.update("edit.toggleHidden", { enabled: canHide(session.ui.getState().nodeId) });
    registry.update("edit.rename", { enabled: selectedLayer() !== undefined });
  };
  update();
  // The selection, or the page under it, changes what can be hidden.
  const stopSelection = session.ui.subscribe(update);
  const stopDocument = session.history.document.subscribe(update);
  return {
    remove: () => {
      stopDocument();
      stopSelection();
      stopRequests();
      removeRename();
      removeCommand();
    },
    setLayoutLocked: (next) => {
      locked = next;
      update();
    },
  };
}
