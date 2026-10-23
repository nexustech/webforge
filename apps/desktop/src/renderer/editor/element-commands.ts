import type { CanvasEngine } from "@webforge/engine";
import { t } from "@webforge/i18n";
import { type LayersSession, toggleLayerHidden } from "../layers/layers.js";
import type { CommandRegistry } from "../shell/commands.js";

/**
 * *Hide or show* for the selected element (F-ED-27: Mod + /) in the Edit menu and the command
 * box, and what the canvas's quick actions ask of the app (F-ED-25): hiding or showing an element,
 * and the image picker for *Edit* on an image (`pickImage`). Hiding is Layers' own step ("Hid
 * Heading"), so it reads the same wherever it is done; Content mode's lock (M3) turns it off.
 * Returns a function that removes them, and ones that follow the selection and the lock.
 */
export function registerElementCommands(
  registry: CommandRegistry,
  session: LayersSession,
  engine: CanvasEngine,
  beforeAction: () => void,
  pickImage: (nodeId: string) => void,
): {
  readonly remove: () => void;
  readonly setHasSelection: (selected: boolean) => void;
  readonly setLayoutLocked: (locked: boolean) => void;
} {
  let selected = false;
  let locked = false;
  const removeCommand = registry.register({
    id: "edit.toggleHidden",
    label: t("canvas.toggleHidden"),
    menu: "edit",
    shortcut: "Mod+/",
    textShortcut: true,
    enabled: false,
    run: () => {
      const { nodeId } = session.ui.getState();
      if (nodeId === null) return;
      beforeAction();
      toggleLayerHidden(session, nodeId);
    },
  });
  const stopRequests = engine.onElementRequest((request) => {
    if (request.kind === "pickImage") {
      pickImage(request.nodeId);
      return;
    }
    if (locked) return;
    beforeAction();
    toggleLayerHidden(session, request.nodeId);
  });
  const update = () => registry.update("edit.toggleHidden", { enabled: selected && !locked });
  return {
    remove: () => {
      stopRequests();
      removeCommand();
    },
    setHasSelection: (next) => {
      selected = next;
      update();
    },
    setLayoutLocked: (next) => {
      locked = next;
      update();
    },
  };
}
