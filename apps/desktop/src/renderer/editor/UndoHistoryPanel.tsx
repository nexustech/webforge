import { cn, ScrollArea } from "@webforge/editor-ui";
import type { HistoryManager, HistoryState } from "@webforge/history";
import { t } from "@webforge/i18n";
import { CheckIcon } from "lucide-react";
import { type KeyboardEvent, useState } from "react";

/** Props of {@link UndoHistoryPanel}. */
export type UndoHistoryPanelProps = {
  readonly history: Pick<HistoryManager<unknown, unknown>, "jumpTo">;
  readonly state: HistoryState<unknown>;
};

/** The key of the first step, the opened page, which has no entry. */
const START = "start";

/** Where a step stands relative to the current position. */
type StepState = "done" | "current" | "undone";

/**
 * Undo History (D3, F-ED-9): labelled steps, newest at the top, the current step highlighted and
 * later (redoable) steps greyed until a new edit discards them. Clicking a step jumps there, which
 * also brings back the page and selection of that moment (U3). Lives in the left column's bottom
 * tabs in Simple and Advanced mode.
 *
 * The list is one Tab stop (F27, #1179): the step last focused, else the current one. Up and Down
 * move between steps, Home and End to the newest and the oldest, Enter or Space goes to one.
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
  /** The step last focused, by its key: the list's Tab stop while it's still listed. */
  const [focused, setFocused] = useState<string | undefined>(undefined);
  const keyOf = (id: string | null) => id ?? START;
  const tabStop = steps.some((step) => keyOf(step.id) === focused)
    ? focused
    : keyOf(steps.find((step) => step.position === state.cursor)?.id ?? null);

  /** Up and Down to the next step, Home and End to the newest and the oldest. */
  const onKeyDown = (event: KeyboardEvent<HTMLOListElement>) => {
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
    const at = buttons.indexOf(event.target as HTMLButtonElement);
    const to =
      event.key === "ArrowDown"
        ? at + 1
        : event.key === "ArrowUp"
          ? at - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? buttons.length - 1
              : undefined;
    if (at === -1 || to === undefined) return;
    event.preventDefault();
    buttons[Math.max(0, Math.min(to, buttons.length - 1))]?.focus();
  };

  return (
    <ScrollArea className="h-full">
      <ol aria-label={t("editor.undoHistory")} className="p-1" onKeyDown={onKeyDown}>
        {steps.map((step) => {
          const stepState = stateOf(step.position);
          return (
            <li key={keyOf(step.id)}>
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
                tabIndex={keyOf(step.id) === tabStop ? 0 : -1}
                onFocus={() => setFocused(keyOf(step.id))}
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
