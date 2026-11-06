import type { IpcMain } from "electron";
import { z } from "zod";
import {
  applyPreferencesChange,
  DEFAULT_PREFERENCES,
  type Preferences,
  type PreferencesChange,
  preferencesSchema,
} from "../shared/ipc/prefs.js";
import { registerIpcHandler } from "./ipc.js";
import { createJsonStore } from "./json-store.js";

/** The person's editor preferences, kept in one JSON file. */
export type PreferencesStore = {
  get(): Preferences;
  /** Applies `change`, saves the file and returns all preferences. */
  set(change: PreferencesChange): Promise<Preferences>;
};

/**
 * Reads the preferences in `file` (e.g. `<userData>/preferences.json`). A missing, unreadable or
 * invalid file gives the defaults, and so does each invalid field of an otherwise good file:
 * a damaged preference never stops the editor from opening. Saves go through
 * {@link createJsonStore}, one after another, so an older write can never land after a newer one;
 * a file that isn't JSON is written over, as the defaults lose nothing.
 */
export async function openPreferencesStore(file: string): Promise<PreferencesStore> {
  const store = createJsonStore(file, z.unknown().transform(parsePreferences), {
    empty: DEFAULT_PREFERENCES,
    onDamaged: "reset",
  });
  let current = await store.read().catch(() => DEFAULT_PREFERENCES);

  return {
    get: () => current,
    set(change) {
      current = preferencesSchema.parse(applyPreferencesChange(current, change));
      const snapshot = current;
      // A failed write doesn't block later ones; its caller still sees the error.
      return store.update(() => snapshot).then(() => snapshot);
    },
  };
}

/** The preferences in `raw`, field by field, with defaults for anything missing or invalid. */
export function parsePreferences(raw: unknown): Preferences {
  if (typeof raw !== "object" || raw === null) {
    return DEFAULT_PREFERENCES;
  }
  const record = raw as Record<string, unknown>;
  const field = <K extends keyof Preferences>(key: K): Preferences[K] => {
    const parsed = preferencesSchema.shape[key].safeParse(record[key]);
    return parsed.success ? (parsed.data as Preferences[K]) : DEFAULT_PREFERENCES[key];
  };
  return {
    theme: field("theme"),
    editorLevel: field("editorLevel"),
    panelLayout: field("panelLayout"),
    window: field("window"),
    canvas: field("canvas"),
    add: field("add"),
    editPanel: field("editPanel"),
    versionsKept: field("versionsKept"),
  };
}

/**
 * Serves `prefs:get` and `prefs:set`. `onChange` runs after each change, e.g. to recolour the
 * native window controls when the theme changes.
 */
export function registerPreferencesHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  store: PreferencesStore,
  onChange: (preferences: Preferences) => void,
): void {
  registerIpcHandler(ipc, "getPreferences", isTrustedSender, () => store.get());
  registerIpcHandler(ipc, "setPreferences", isTrustedSender, async (change) => {
    const preferences = await store.set(change);
    onChange(preferences);
    return preferences;
  });
}
