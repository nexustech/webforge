import type { HistoryCommand } from "@webforge/engine";
import { t } from "@webforge/i18n";
import { HistoryIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import type { Area, EditorContext } from "../editor/areas.js";
import { type EditorSession, runHistoryCommand } from "../editor/editor-session.js";
import { UndoHistoryPanel, type UndoHistoryPanelProps } from "../editor/UndoHistoryPanel.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { availability } from "../shell/commands.js";

/** Undo's or Redo's `enabled`, and when off why (#1010): there's no step to undo or redo. */
const undoable = (can: boolean, none: "editor.undo.none" | "editor.redo.none") =>
  availability(can ? undefined : t(none));

/** The Undo History panel for `history`, jumping to a step with `jumpTo`. */
function undoHistoryPanel(
  history: EditorSession["history"],
  jumpTo: UndoHistoryPanelProps["history"]["jumpTo"],
) {
  return function UndoHistory() {
    const state = useSyncExternalStore(
      history.state.subscribe,
      history.state.getState,
      history.state.getState,
    );
    return <UndoHistoryPanel history={{ jumpTo }} state={state} />;
  };
}

/**
 * Undo and Redo in the title bar, the Edit menu and the command box (1.2), on and off as there is
 * a step to undo or redo (saying so while there's none), and the Undo History panel in the left column's bottom (UI1) (#668,
 * A21). First in the editor's list, so Undo and Redo head the Edit menu. The canvas's pending
 * edit is flushed first, so it is a step of its own.
 */
export const undoHistoryArea: Area<EditorContext> = {
  id: "undoHistory",
  register: ({ session, commands, panels, engine }) => {
    const { history } = session;
    const runCommand = (command: HistoryCommand) => {
      engine.flush();
      runHistoryCommand(session, command);
    };
    const removeUndo = commands.register({
      id: COMMAND_IDS.undo,
      label: t("editor.undo"),
      menu: "edit",
      ...undoable(history.state.getState().canUndo, "editor.undo.none"),
      run: () => runCommand("undo"),
    });
    const removeRedo = commands.register({
      id: COMMAND_IDS.redo,
      label: t("editor.redo"),
      menu: "edit",
      ...undoable(history.state.getState().canRedo, "editor.redo.none"),
      run: () => runCommand("redo"),
    });
    const stopFollowing = history.state.subscribe((state) => {
      commands.update(COMMAND_IDS.undo, undoable(state.canUndo, "editor.undo.none"));
      commands.update(COMMAND_IDS.redo, undoable(state.canRedo, "editor.redo.none"));
    });
    const removePanel = panels.register({
      id: "undoHistory",
      slot: "left.bottom",
      title: t("editor.undoHistory"),
      description: t("editor.undoHistory.description"),
      icon: HistoryIcon,
      component: undoHistoryPanel(history, (entryId) => {
        engine.flush();
        return history.jumpTo(entryId);
      }),
    });
    return () => {
      removePanel();
      stopFollowing();
      removeRedo();
      removeUndo();
    };
  },
};
