import type { EditorMode } from "@webforge/engine";
import type { ReadonlyStore } from "@webforge/history";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { createStore } from "zustand/vanilla";
import { applyPreferencesChange, DEFAULT_PREFERENCES } from "../../shared/ipc/prefs.js";
import type { Preferences, PreferencesChange } from "../../shared/ipc-contract.js";
import { reportFailure } from "../log.js";

/** The person's preferences (theme, panels, canvas, Add panel) and the open site's editor mode. */
export type EditorPreferences = {
  readonly preferences: Preferences;
  /** Design or Content (M3): remembered with the open site, never an undo step. */
  readonly mode: EditorMode;
};

/**
 * The editor's preferences (R9): read by the window, the canvas toolbar, the editor, the Add panel
 * and commands alike, and changed only with {@link PreferencesStore.change} and
 * {@link PreferencesStore.changeMode}, which save what they change.
 */
export type PreferencesStore = ReadonlyStore<EditorPreferences> & {
  /** Changes some groups of preferences at once, and saves them. */
  change(update: PreferencesChange): void;
  /** Switches Design or Content mode, and remembers it with the open site. */
  changeMode(mode: EditorMode): void;
};

/** Where {@link createPreferencesStore} saves changes; nowhere unless given. */
export type PreferencesSaving = {
  readonly preferences?: (change: PreferencesChange) => Promise<unknown>;
  readonly mode?: (mode: EditorMode) => Promise<unknown>;
};

/** A store for `initial` (the defaults, in Design mode, unless given) that saves with `save`. */
export function createPreferencesStore(
  initial: Partial<EditorPreferences> = {},
  save: PreferencesSaving = {},
): PreferencesStore {
  const store = createStore<EditorPreferences>()(() => ({
    preferences: initial.preferences ?? DEFAULT_PREFERENCES,
    mode: initial.mode ?? "design",
  }));
  return {
    getState: store.getState,
    getInitialState: store.getInitialState,
    subscribe: store.subscribe,
    change(update) {
      const { preferences } = store.getState();
      store.setState({ preferences: applyPreferencesChange(preferences, update) });
      save.preferences?.(update).catch((error: unknown) => {
        reportFailure("preferences.save", error);
      });
    },
    changeMode(mode) {
      if (mode === store.getState().mode) return;
      store.setState({ mode });
      // Without an open site (the starter site) the mode lasts until the window closes.
      save.mode?.(mode).catch((error: unknown) => {
        reportFailure("editor-mode.save", error);
      });
    },
  };
}

/**
 * Calls `setLocked` with whether the mode locks the layout (Content mode, M3): now, and again each
 * time that changes. Returns how to stop following it.
 */
export function followLayoutLock(
  store: ReadonlyStore<EditorPreferences>,
  setLocked: (locked: boolean) => void,
): () => void {
  let locked = store.getState().mode !== "design";
  setLocked(locked);
  return store.subscribe((state) => {
    const next = state.mode !== "design";
    if (next === locked) return;
    locked = next;
    setLocked(next);
  });
}

/** The part of the preferences a component draws: it redraws only when that part changes. */
export function usePreferences<T>(
  store: ReadonlyStore<EditorPreferences>,
  selector: (state: EditorPreferences) => T,
  equals?: (a: T, b: T) => boolean,
): T {
  return useStoreWithEqualityFn(store, selector, equals);
}
