import type { StoreApi } from "zustand/vanilla";
import type { Autosave } from "./autosave.js";

/** Where the triggers listen; the window in the app, a fake in tests. */
type TriggerTarget = Pick<Window, "addEventListener" | "removeEventListener">;

/**
 * Saves at the moments P2 names besides the timer: when the app loses focus, when another page is
 * shown, and when the main process asks (the window is closing, or Ctrl/Cmd+S was pressed, which
 * main sees even inside the canvas iframe). Returns a function that removes every trigger.
 */
export function installSaveTriggers(
  target: TriggerTarget,
  autosave: Autosave,
  ui: StoreApi<{ readonly pageId: string }>,
  onFlushRequest: (save: () => Promise<void>) => () => void,
  /** Whether the app's document (or a frame in it, like the canvas) has focus. */
  hasFocus: () => boolean = () => document.hasFocus(),
): () => void {
  const flush = () => void autosave.flush();
  let blurCheck: ReturnType<typeof setTimeout> | undefined;
  // The window also blurs when focus moves into the canvas iframe; that is still editing. Once the
  // focus has settled, save only if it really left the app.
  const onBlur = () => {
    clearTimeout(blurCheck);
    blurCheck = setTimeout(() => {
      if (!hasFocus()) flush();
    }, 0);
  };
  target.addEventListener("blur", onBlur);
  const unsubscribePage = ui.subscribe((next, previous) => {
    if (next.pageId !== previous.pageId) flush();
  });
  const stopFlushRequests = onFlushRequest(() => autosave.flush());
  return () => {
    clearTimeout(blurCheck);
    target.removeEventListener("blur", onBlur);
    unsubscribePage();
    stopFlushRequests();
  };
}
