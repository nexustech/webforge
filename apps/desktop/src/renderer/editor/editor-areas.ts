import { toast } from "@webforge/editor-ui";
import { followLayoutLock } from "../shell/preferences-store.js";
import type { Area, EditorContext } from "./areas.js";
import { deleteSelected, duplicateSelected, moveSelected } from "./bulk-layers.js";
import { columnsToolbar } from "./ColumnsToolbar.js";
import { type BulkCanvasAction, registerCanvasCommands } from "./canvas-commands.js";
import { registerElementCommands } from "./element-commands.js";
import { connectFieldDrags } from "./field-drag.js";
import { headerToolbar } from "./HeaderToolbar.js";
import { headingToolbar } from "./HeadingToolbar.js";
import { listToolbar } from "./ListToolbar.js";
import { connectSiteCss } from "./site-css.js";

// The editor's own areas (2.20, B1): what it registers around the canvas besides the other areas'.

/** The site's CSS in the canvas, compiled again as the theme changes. */
export const siteCssArea: Area<EditorContext> = {
  id: "siteCss",
  register: ({ engine, session, compileCss }) =>
    engine.whileMounted(({ engine: canvas }) => connectSiteCss(canvas, session, compileCss)),
};

/**
 * Keyboard actions on the selected element (1.12), in the Edit menu and the command box; their
 * shortcuts also work while the canvas iframe has focus.
 */
export const canvasCommandsArea: Area<EditorContext> = {
  id: "canvasCommands",
  register: ({ engine, session, commands, preferences }) =>
    engine.whileMounted(({ engine: canvas, connection }) => {
      // While several elements are selected, the canvas's edits act on all of them (1.31).
      const bulk = (action: BulkCanvasAction) => {
        const { refused } =
          action === "delete"
            ? deleteSelected(session)
            : action === "duplicate"
              ? duplicateSelected(session)
              : moveSelected(session, action === "moveUp" ? "up" : "down");
        if (refused !== undefined) toast(refused);
      };
      const canvasCommands = registerCanvasCommands(commands, canvas, connection.flush, bulk);
      canvasCommands.setHasSelection(session.ui.getState().nodeId !== null);
      const stopLock = followLayoutLock(preferences, canvasCommands.setLayoutLocked);
      const stopSelection = session.ui.subscribe((ui) => {
        // Several selected elements (1.31): the edits that act on one are off until they act on all.
        canvasCommands.setHasSelection(ui.nodeId !== null);
        canvasCommands.setSeveral((ui.others ?? []).length > 0);
      });
      return () => {
        stopSelection();
        stopLock();
        canvasCommands.remove();
      };
    }),
};

/** Hide or show (Mod + /), and the chip's Hide and Edit on an image (1.30). */
export const elementCommandsArea: Area<EditorContext> = {
  id: "elementCommands",
  register: ({ engine, session, commands, preferences, dialogs }) =>
    engine.whileMounted(({ engine: canvas, connection }) => {
      const elementCommands = registerElementCommands(
        commands,
        session,
        canvas,
        connection.flush,
        dialogs.pickImage,
        dialogs.rename,
        (message) => toast(message),
      );
      const stopLock = followLayoutLock(preferences, elementCommands.setLayoutLocked);
      return () => {
        stopLock();
        elementCommands.remove();
      };
    }),
};

/** Drags of the spacing handles (1.32), one step each, as the Edit panel makes them. */
export const fieldDragsArea: Area<EditorContext> = {
  id: "fieldDrags",
  register: ({ engine, session }) =>
    engine.whileMounted(({ engine: canvas, connection }) =>
      connectFieldDrags(canvas, session, connection.flush),
    ),
};

/** The selected Heading's and List's own toolbars, in the row under the canvas toolbar (SP-4). */
export const textToolbarsArea: Area<EditorContext> = {
  id: "textToolbars",
  register: ({ toolbars, session, engine }) => {
    const removeHeading = toolbars.register(headingToolbar({ session, flush: engine.flush }));
    const removeList = toolbars.register(listToolbar({ session, flush: engine.flush }));
    return () => {
      removeHeading();
      removeList();
    };
  },
};

/** The selected Header's own toolbar (SP-4), with its edit-only previews (UX-26). */
export const headerToolbarArea: Area<EditorContext> = {
  id: "headerToolbar",
  register: ({ toolbars, session, editPreviews }) =>
    toolbars.register(headerToolbar({ session, previews: editPreviews })),
};

/** The selected Columns' or Column's own toolbar (SP-4, 2.17), with the column outlines (UX-26). */
export const columnsToolbarArea: Area<EditorContext> = {
  id: "columnsToolbar",
  register: ({ toolbars, session, engine, editPreviews }) =>
    toolbars.register(columnsToolbar({ session, flush: engine.flush, previews: editPreviews })),
};
