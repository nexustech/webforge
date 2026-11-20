import type { HistoryCommand } from "@webforge/engine";
import type { HistoryState } from "@webforge/history";
import { t } from "@webforge/i18n";
import { HistoryIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import type { Area, EditorContext } from "../editor/areas.js";
import { type EditorSession, runHistoryCommand } from "../editor/editor-session.js";
import { UndoHistoryPanel, type UndoHistoryPanelProps } from "../editor/UndoHistoryPanel.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { availability } from "../shell/commands.js";

/**
 * Undo's and Redo's `enabled`, when off why (#1010): there's no step to undo or redo, and when on
 * their tooltips, naming the step (#1011).
 */
function undoable(state: HistoryState<unknown>) {
  const undo = state.canUndo ? state.entries[state.cursor - 1] : undefined;
  const redo = state.canRedo ? state.entries[state.cursor] : undefined;
  return {
    undo: {
      ...availability(undo === undefined ? t("editor.undo.none") : undefined),
      tooltip: undo === undefined ? undefined : t("editor.undo.step", { step: undo.label }),
    },
    redo: {
      ...availability(redo === undefined ? t("editor.redo.none") : undefined),
      tooltip: redo === undefined ? undefined : t("editor.redo.step", { step: redo.label }),
    },
  };
}

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

/** Undo History's panel id: View › Undo History shows it (#1165). */
const UNDO_HISTORY_PANEL_ID = "undoHistory";

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
    const now = undoable(history.state.getState());
    const removeUndo = commands.register({
      id: COMMAND_IDS.undo,
      label: t("editor.undo"),
      menu: "edit",
      ...now.undo,
      run: () => runCommand("undo"),
    });
    const removeRedo = commands.register({
      id: COMMAND_IDS.redo,
      label: t("editor.redo"),
      menu: "edit",
      ...now.redo,
      run: () => runCommand("redo"),
    });
    const stopFollowing = history.state.subscribe((state) => {
      const next = undoable(state);
      commands.update(COMMAND_IDS.undo, next.undo);
      commands.update(COMMAND_IDS.redo, next.redo);
    });
    const removePanel = panels.register({
      id: UNDO_HISTORY_PANEL_ID,
      slot: "left.bottom",
      title: t("editor.undoHistory"),
      description: t("editor.undoHistory.description"),
      icon: HistoryIcon,
      component: undoHistoryPanel(history, (entryId) => {
        engine.flush();
        return history.jumpTo(entryId);
      }),
    });
    // View › Undo History, and the command box (#1165): its panel was only a tab's icon.
    const removeShow = commands.register({
      id: COMMAND_IDS.undoHistory,
      label: t("editor.undoHistory"),
      menu: "view",
      run: () => panels.show(UNDO_HISTORY_PANEL_ID),
    });
    return () => {
      removeShow();
      removePanel();
      stopFollowing();
      removeRedo();
      removeUndo();
    };
  },
};
