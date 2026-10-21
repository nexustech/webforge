import { z } from "zod";

/** At most this many panel groups, and panels per group, are remembered. */
const MAX_LAYOUT_ENTRIES = 32;

const fewEntries = (record: Record<string, unknown>) =>
  Object.keys(record).length <= MAX_LAYOUT_ENTRIES;

/** A panel group's sizes: panel id → percentage of the group (react-resizable-panels' layout). */
const panelGroupLayoutSchema = z
  .record(z.string().min(1).max(64), z.number().min(0).max(100))
  .refine(fewEntries);

/** The main window's size and place when it isn't maximised, in screen pixels. */
const windowBoundsSchema = z.strictObject({
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int().min(1).max(100_000),
  height: z.number().int().min(1).max(100_000),
});

/** How the person left the main window: maximised or not, and its size when it isn't. */
const windowStateSchema = z.strictObject({
  maximized: z.boolean(),
  bounds: windowBoundsSchema,
});

/**
 * One person's editor preferences (per user, not per site; T2). Stored by main in
 * `<userData>/preferences.json`.
 */
export const preferencesSchema = z.strictObject({
  /** The editor's look (UI1). */
  theme: z.enum(["dark", "light"]),
  /** Simple hides Layers, the Advanced tab and Custom Code (T2, 1.10). */
  editorLevel: z.enum(["simple", "advanced"]),
  /** Remembered panel sizes, by panel group id. Empty means the default layout. */
  panelLayout: z.record(z.string().min(1).max(64), panelGroupLayoutSchema).refine(fewEntries),
  /** The main window as the person last left it; null until then (it opens maximised, ADR 0008). */
  window: windowStateSchema.nullable(),
});

/** One person's editor preferences. */
export type Preferences = z.infer<typeof preferencesSchema>;

/** Preferences for someone who hasn't changed any. */
export const DEFAULT_PREFERENCES: Preferences = {
  theme: "dark",
  editorLevel: "simple",
  panelLayout: {},
  window: null,
};

/** A change to some preferences; the rest stay as they are. */
const preferencesChangeSchema = preferencesSchema.partial();

/** A change to some preferences. */
export type PreferencesChange = z.infer<typeof preferencesChangeSchema>;

/** `preferences` with `change` applied; fields the change leaves out (or undefined) stay. */
export function applyPreferencesChange(
  preferences: Preferences,
  change: PreferencesChange,
): Preferences {
  return {
    theme: change.theme ?? preferences.theme,
    editorLevel: change.editorLevel ?? preferences.editorLevel,
    panelLayout: change.panelLayout ?? preferences.panelLayout,
    window: change.window === undefined ? preferences.window : change.window,
  };
}

/** IPC channels of the `prefs` domain (`prefs:*`). */
export const prefsChannels = {
  getPreferences: {
    channel: "prefs:get",
    request: z.tuple([]),
    response: preferencesSchema,
  },
  /** Changes some preferences, saves them and returns them all. */
  setPreferences: {
    channel: "prefs:set",
    request: z.tuple([preferencesChangeSchema]),
    response: preferencesSchema,
  },
} as const;

/** `window.webforge.prefs`. */
export interface PrefsApi {
  /** The current preferences (defaults until the person changes something). */
  get(): Promise<Preferences>;
  /** Changes some preferences and returns them all. */
  set(change: PreferencesChange): Promise<Preferences>;
}
