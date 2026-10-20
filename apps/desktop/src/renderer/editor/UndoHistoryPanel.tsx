import type { HistoryManager, HistoryState } from "@webforge/history";
import { t } from "@webforge/i18n";

/** Props of {@link UndoHistoryPanel}. */
export type UndoHistoryPanelProps = {
  readonly history: Pick<HistoryManager<unknown, unknown>, "jumpTo">;
  readonly state: HistoryState<unknown>;
};

/**
 * Undo History (D3): labelled steps, newest at the top, the current step highlighted and later
 * (redoable) steps greyed out. Clicking a step jumps there.
 */
export function UndoHistoryPanel({ history, state }: UndoHistoryPanelProps) {
  const steps = [
    { id: null, label: t("editor.historyStart"), position: 0 },
    ...state.entries.map((entry, index) => ({
      id: entry.id,
      label: entry.label,
      position: index + 1,
    })),
  ].toReversed();

  return (
    <aside className="undo-history" aria-label={t("editor.undoHistory")}>
      <h2 className="sr-only">{t("editor.undoHistory")}</h2>
      <ol className="undo-history__list">
        {steps.map((step) => (
          <li key={step.id ?? "start"}>
            <button
              type="button"
              className="undo-history__step"
              data-state={
                step.position === state.cursor
                  ? "current"
                  : step.position > state.cursor
                    ? "undone"
                    : "done"
              }
              aria-current={step.position === state.cursor ? "step" : undefined}
              onClick={() => history.jumpTo(step.id)}
            >
              {step.label}
            </button>
          </li>
        ))}
      </ol>
    </aside>
  );
}
