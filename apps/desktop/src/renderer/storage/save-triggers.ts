import type { StoreApi } from "zustand/vanilla";
import type { Autosave } from "./autosave.js";

/** Where the triggers listen; the window in the app, a fake in tests. */
type TriggerTarget = Pick<Window, "addEventListener" | "removeEventListener">;

/**
 * Saves at the moments P2 names besides the timer: when the window loses focus, when another page
 * is shown, when Ctrl/Cmd+S is pressed ("Save now") and when the main process says the window is
 * closing. Returns a function that removes every trigger.
 */
export function installSaveTriggers(
  target: TriggerTarget,
  autosave: Autosave,
  ui: StoreApi<{ readonly pageId: string }>,
  onFlushRequest: (save: () => Promise<void>) => () => void,
): () => void {
  const flush = () => void autosave.flush();
  const onKeyDown = (event: KeyboardEvent) => {
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "s") {
      // The browser's own "Save page as…" never applies to the editor.
      event.preventDefault();
      flush();
    }
  };
  target.addEventListener("blur", flush);
  target.addEventListener("keydown", onKeyDown);
  const unsubscribePage = ui.subscribe((next, previous) => {
    if (next.pageId !== previous.pageId) flush();
  });
  const stopFlushRequests = onFlushRequest(() => autosave.flush());
  return () => {
    target.removeEventListener("blur", flush);
    target.removeEventListener("keydown", onKeyDown);
    unsubscribePage();
    stopFlushRequests();
  };
}
