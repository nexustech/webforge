import type { CanvasEngine } from "@webforge/engine";
import { t } from "@webforge/i18n";
import { toggleSelectedHidden } from "../layers/bulk-layers.js";
import { type Layer, type LayersSession, shownLayer, toggleLayerHidden } from "../layers/layers.js";
import type { CommandRegistry } from "../shell/commands.js";
import { splitText } from "./split-text.js";

/**
 * *Hide or show* for the selected element (F-ED-27: Mod + /) in the Edit menu and the command
 * box, and what the canvas's quick actions ask of the app (F-ED-25): hiding or showing an element,
 * and the image picker for *Edit* on an image (`pickImage`). Hiding is Layers' own step ("Hid
 * Heading"), so it reads the same wherever it is done, and only a layer can be hidden: not an
 * element of the shared Header or Footer, nor one inside a linked copy. Content mode's lock (M3)
 * turns it off. *Rename…* (F2, 1.30) asks for a layer's name (`rename`), in Content mode too: names
 * aren't layout. While several elements are selected, Mod + / hides or shows them all as one step,
 * or `notify` says why it can't (1.31). Returns a function that removes them, and one that follows
 * the lock.
 */
export function registerElementCommands(
  registry: CommandRegistry,
  session: LayersSession,
  engine: CanvasEngine,
  beforeAction: () => void,
  pickImage: (nodeId: string) => void,
  rename: (layer: Layer) => void,
  notify: (message: string) => void = () => undefined,
): {
  readonly remove: () => void;
  readonly setLayoutLocked: (locked: boolean) => void;
} {
  let locked = false;
  /** Whether element `id` can be hidden or shown now. */
  const several = () => (session.ui.getState().others ?? []).length > 0;
  /** Whether element `id` alone can be hidden or shown: a layer, while the layout isn't locked. */
  const canHideOne = (id: string) => !locked && shownLayer(session, id) !== undefined;
  // Several are tried together, and the reason given if they can't be (1.31).
  const canHide = (id: string | null) => id !== null && (several() ? !locked : canHideOne(id));
  const hide = (id: string) => {
    if (!canHideOne(id)) return;
    beforeAction();
    toggleLayerHidden(session, id);
  };
  const removeCommand = registry.register({
    id: "edit.toggleHidden",
    label: t("canvas.toggleHidden"),
    menu: "edit",
    enabled: false,
    run: () => {
      const { nodeId } = session.ui.getState();
      if (nodeId === null || locked) return;
      if (several()) {
        beforeAction();
        const { refused } = toggleSelectedHidden(session);
        if (refused !== undefined) notify(refused);
      } else {
        hide(nodeId);
      }
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
  // Alt + Enter in rich text (F-ED-27): adding an element changes the layout, which Content mode
  // locks (M3).
  const stopSplits = engine.onTextSplit((split) => {
    if (locked) {
      notify(t("canvas.splitText.locked"));
      return;
    }
    beforeAction();
    if (splitText(session, split, notify) !== undefined) {
      // The text after the caret is edited on, as the editor was.
      requestAnimationFrame(() => engine.perform("editText"));
    }
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
      stopSplits();
      removeRename();
      removeCommand();
    },
    setLayoutLocked: (next) => {
      locked = next;
      update();
    },
  };
}
