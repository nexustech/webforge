import { readFile, rename, writeFile } from "node:fs/promises";
import type { IpcMain } from "electron";
import {
  applyPreferencesChange,
  DEFAULT_PREFERENCES,
  type Preferences,
  type PreferencesChange,
  preferencesSchema,
} from "../shared/ipc/prefs.js";
import { registerIpcHandler } from "./ipc.js";

/** The person's editor preferences, kept in one JSON file. */
export type PreferencesStore = {
  get(): Preferences;
  /** Applies `change`, saves the file and returns all preferences. */
  set(change: PreferencesChange): Promise<Preferences>;
};

/**
 * Reads the preferences in `file` (e.g. `<userData>/preferences.json`). A missing, unreadable or
 * invalid file gives the defaults, and so does each invalid field of an otherwise good file:
 * a damaged preference never stops the editor from opening.
 */
export async function openPreferencesStore(file: string): Promise<PreferencesStore> {
  let current = parsePreferences(await readJson(file));
  // Saves run one after another, so an older write can never land after a newer one.
  let saving: Promise<unknown> = Promise.resolve();

  return {
    get: () => current,
    set(change) {
      current = preferencesSchema.parse(applyPreferencesChange(current, change));
      const snapshot = current;
      // A failed write doesn't block later ones; its caller still sees the error.
      const write = saving
        .catch(() => undefined)
        .then(() => writeAtomically(file, `${JSON.stringify(snapshot, null, 2)}\n`));
      saving = write;
      return write.then(() => snapshot);
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
  };
}

async function readJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return undefined;
  }
}

/** Writes next to the file and renames over it, so a crash never leaves half a file. */
async function writeAtomically(file: string, contents: string): Promise<void> {
  const temporary = `${file}.tmp`;
  await writeFile(temporary, contents, "utf8");
  await rename(temporary, file);
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
