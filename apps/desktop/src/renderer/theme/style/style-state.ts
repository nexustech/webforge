import { createStore, type StoreApi } from "zustand/vanilla";
import type { StyleScope } from "./style-apply.js";

/**
 * Whether *Style this ‹kind›…* is open (3.13a), the history step its changes come after, so they
 * become one step, and where they apply.
 */
export type StyleDialogState = {
  readonly open: boolean;
  readonly since: string | null;
  readonly scope: StyleScope;
};

/** The dialog's state, made once for the window: its command opens it from anywhere. */
export function createStyleDialog(): StoreApi<StyleDialogState> {
  return createStore<StyleDialogState>()(() => ({ open: false, since: null, scope: "this" }));
}
