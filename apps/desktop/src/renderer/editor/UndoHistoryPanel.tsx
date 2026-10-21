import { cn, ScrollArea } from "@webforge/editor-ui";
import type { HistoryManager, HistoryState } from "@webforge/history";
import { t } from "@webforge/i18n";
import { CheckIcon } from "lucide-react";

/** Props of {@link UndoHistoryPanel}. */
export type UndoHistoryPanelProps = {
  readonly history: Pick<HistoryManager<unknown, unknown>, "jumpTo">;
  readonly state: HistoryState<unknown>;
};

/** Where a step stands relative to the current position. */
type StepState = "done" | "current" | "undone";

/**
 * Undo History (D3, F-ED-9): labelled steps, newest at the top, the current step highlighted and
 * later (redoable) steps greyed until a new edit discards them. Clicking a step jumps there, which
 * also brings back the page and selection of that moment (U3). Lives in the left column's bottom
 * tabs in Simple and Advanced mode.
 *
 * Each step keeps the `undo-history__step` class: tests and the perf check find steps by it.
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
  const stateOf = (position: number): StepState =>
    position === state.cursor ? "current" : position > state.cursor ? "undone" : "done";

  return (
    <ScrollArea className="h-full">
      <ol aria-label={t("editor.undoHistory")} className="p-1">
        {steps.map((step) => {
          const stepState = stateOf(step.position);
          return (
            <li key={step.id ?? "start"}>
              <button
                type="button"
                className={cn(
                  "undo-history__step flex h-6 w-full items-center gap-1.5 rounded-sm px-2 text-left text-xs outline-none",
                  "hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  stepState === "current" && "bg-accent font-medium text-accent-foreground",
                  // Greyed, yet still readable (4.5:1 on the panel): it can be clicked to redo.
                  stepState === "undone" && "text-muted-foreground",
                )}
                data-state={stepState}
                aria-current={stepState === "current" ? "step" : undefined}
                onClick={() => history.jumpTo(step.id)}
              >
                <CheckIcon
                  aria-hidden
                  className={cn("size-3.5 shrink-0", stepState !== "current" && "invisible")}
                />
                <span className="truncate">{step.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </ScrollArea>
  );
}
