import type { CommitOptions, Recipe } from "@webforge/history";
import type { SiteDoc } from "@webforge/model";
import { useEffect, useRef } from "react";
import type { EditKind, EditorSelection, EditorSession, Gesture } from "./editor-session.js";

/** What {@link useGesture} returns to a control such as a slider. */
export type GestureControls = {
  /** Applies a live change, starting the gesture on the first one. */
  update(recipe: Recipe<SiteDoc>): void;
  /** Ends the gesture as one undo step labelled `label` (nothing if nothing changed). */
  commit(options?: CommitOptions<EditorSelection>): void;
  /** Puts the document back as it was before the gesture. */
  cancel(): void;
};

/**
 * A gesture for a control that changes the document continuously, such as a slider: call `update`
 * while the pointer moves and `commit` when it is released, for one undo step (U2). Esc cancels it
 * (see `runHistoryCommand`), and so does unmounting the control mid-gesture.
 */
export function useGesture(session: EditorSession, kind: EditKind, label: string): GestureControls {
  const gesture = useRef<Gesture | null>(null);
  useEffect(
    () => () => {
      if (gesture.current?.active === true) {
        gesture.current.cancel();
      }
    },
    [],
  );
  return {
    update(recipe) {
      if (gesture.current?.active !== true) {
        gesture.current = session.begin(kind, label);
      }
      gesture.current.update(recipe);
    },
    commit(options) {
      if (gesture.current?.active === true) {
        gesture.current.commit(options);
      }
      gesture.current = null;
    },
    cancel() {
      if (gesture.current?.active === true) {
        gesture.current.cancel();
      }
      gesture.current = null;
    },
  };
}
