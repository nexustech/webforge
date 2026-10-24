import type { Editor } from "@tiptap/core";
import { useCallback, useSyncExternalStore } from "react";

/**
 * `editor`'s state, drawing the component again on every change of its content or selection: Puck
 * draws its rich-text menu again only for the formatting it tracks itself, so the link buttons use
 * this to follow the caret.
 *
 * Through `useSyncExternalStore`, which checks the state again once it subscribes: a change made
 * between drawing and subscribing (a selection made straight after the editor starts) isn't
 * missed, as it was with a listener added in an effect (#357), which left Link… off until the next
 * change.
 */
export function useEditorState(editor: Editor | null): Editor["state"] | null {
  const subscribe = useCallback(
    (changed: () => void) => {
      if (editor === null) return () => {};
      editor.on("transaction", changed);
      return () => {
        editor.off("transaction", changed);
      };
    },
    [editor],
  );
  return useSyncExternalStore(
    subscribe,
    () => editor?.state ?? null,
    () => editor?.state ?? null,
  );
}
