/** The keys Puck's own hotkeys delete the selected element with. */
const PUCK_DELETE_KEYS: ReadonlySet<string> = new Set(["Delete", "Backspace"]);

/**
 * Keeps Puck's own Delete and Backspace hotkeys from deleting the selected element in `target` (the
 * editor window, or the canvas iframe's): the app's key map says what those keys do (F-ED-27:
 * Delete deletes, as one labelled step; Backspace empties the selected element's text and edits
 * it). Puck finds its hotkeys by `event.code` in a listener on the document, so this listener on
 * the window, which comes first, hides the code from it. Everything else, the app's shortcuts
 * included, goes by `event.key`, and still gets the key.
 */
export function hidePuckDeleteKeys(target: Window): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (PUCK_DELETE_KEYS.has(event.code)) {
      Object.defineProperty(event, "code", { value: "", configurable: true });
    }
  };
  target.addEventListener("keydown", onKeyDown, { capture: true });
  return () => target.removeEventListener("keydown", onKeyDown, { capture: true });
}
