import type { HistoryManager } from "@webforge/history";
import { t } from "@webforge/i18n";
import type { SiteDoc } from "@webforge/model";

/** How long the change the person accepted may take to reach the history, at the most. */
const ARRIVAL_MS = 1000;

/** The id of the step the history is at: the last one applied, or null with none. */
const currentStep = (history: Pick<HistoryManager<SiteDoc, unknown>, "state">) => {
  const { entries, cursor } = history.state.getState();
  return entries[cursor - 1]?.id ?? null;
};

/**
 * Makes the next change to reach `history` one undo step of its own, labelled as the assistant's
 * (ADR 0026 §1, #873): "AI (Assistant): Edited Hero text". Call it just before the change is made,
 * after ending any typing session the change would otherwise merge into; a change that doesn't
 * arrive within a second is left alone, so a later one isn't taken for it. Returns how to stop
 * waiting.
 */
export function asAssistantStep(
  history: Pick<HistoryManager<SiteDoc, unknown>, "state" | "mergeSince">,
): () => void {
  const before = currentStep(history);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    clearTimeout(timer);
    unsubscribe();
  };
  const unsubscribe = history.state.subscribe(({ entries, cursor }) => {
    const step = entries[cursor - 1];
    if (step === undefined || step.id === before) return;
    stop();
    // Its own step, named for the assistant: nothing typed later merges into it. Once the history
    // has finished telling its listeners about the change, not while it does.
    const label = t("ai.history", { app: t("assistant.name"), action: step.label });
    queueMicrotask(() => history.mergeSince(before, label));
  });
  timer = setTimeout(stop, ARRIVAL_MS);
  return stop;
}
