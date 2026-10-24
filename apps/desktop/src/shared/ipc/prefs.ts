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

/** The canvas's narrowest and widest device: what a custom device may be, in CSS pixels. */
export const DEVICE_SIZE = { min: 320, max: 2560 } as const;

/** At most this many custom devices are kept. */
export const MAX_DEVICES = 20;

/** A device the person added for the canvas (*Add device…*, F-ED-25): its name and size. */
/** The longest name a device of the person's own can have (F-ED-25). */
export const DEVICE_NAME_MAX = 40;

const deviceSchema = z.strictObject({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(DEVICE_NAME_MAX),
  width: z.number().int().min(DEVICE_SIZE.min).max(DEVICE_SIZE.max),
  height: z.number().int().min(DEVICE_SIZE.min).max(DEVICE_SIZE.max),
});

/** A device the person added for the canvas. */
export type CustomDevice = z.infer<typeof deviceSchema>;

/**
 * How the canvas shows the page (F-ED-25, UX-7): the View menu's options, and the person's own
 * devices. View state, never an undo step (U6).
 */
const canvasPreferencesSchema = z.strictObject({
  /** Outlines around elements as the pointer passes over them. */
  showOutlines: z.boolean(),
  /** An element's margins and padding as the pointer passes over it. */
  spacingOnHover: z.boolean(),
  /** Each element's name above it. */
  elementNames: z.boolean(),
  /** Room below the page's last section, to drop into. */
  extraBottomSpace: z.boolean(),
  devices: z.array(deviceSchema).max(MAX_DEVICES),
});

/** How the canvas shows the page. */
export type CanvasPreferences = z.infer<typeof canvasPreferencesSchema>;

/** At most this many favourites, and recently used items, are kept. */
export const MAX_FAVOURITES = 30;
export const MAX_RECENT = 6;

/** An Add panel item: a component type ("Hero") or a shared section's id. */
const addItemKeySchema = z.string().min(1).max(64);

/** The Add panel's favourites and recently used items (F-ED-26, UX-10), per user. */
const addPreferencesSchema = z.strictObject({
  favourites: z.array(addItemKeySchema).max(MAX_FAVOURITES),
  /** Newest first. */
  recent: z.array(addItemKeySchema).max(MAX_RECENT),
});

/** The Add panel's favourites and recently used items. */
export type AddPreferences = z.infer<typeof addPreferencesSchema>;

/** The most component types whose closed option groups are remembered. */
const MAX_CLOSED_GROUP_TYPES = 200;

/**
 * The Edit panel's option groups the person closed (UX-13), by component type, each as `tab:id`
 * ("style:spacing"), so they're kept in any language: UI state, never in the document nor an undo
 * step. Every group is open until closed.
 */
const editPanelPreferencesSchema = z.strictObject({
  closedGroups: z
    .record(z.string().min(1).max(64), z.array(z.string().min(1).max(64)).max(20))
    .refine((byType) => Object.keys(byType).length <= MAX_CLOSED_GROUP_TYPES),
});

/** The Edit panel's remembered option groups. */
export type EditPanelPreferences = z.infer<typeof editPanelPreferencesSchema>;

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
  canvas: canvasPreferencesSchema,
  add: addPreferencesSchema,
  editPanel: editPanelPreferencesSchema,
});

/** One person's editor preferences. */
export type Preferences = z.infer<typeof preferencesSchema>;

/** Preferences for someone who hasn't changed any. */
export const DEFAULT_PREFERENCES: Preferences = {
  theme: "dark",
  editorLevel: "simple",
  panelLayout: {},
  window: null,
  canvas: {
    showOutlines: true,
    spacingOnHover: false,
    elementNames: false,
    extraBottomSpace: false,
    devices: [],
  },
  add: { favourites: [], recent: [] },
  editPanel: { closedGroups: {} },
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
    canvas: change.canvas ?? preferences.canvas,
    add: change.add ?? preferences.add,
    editPanel: change.editPanel ?? preferences.editPanel,
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
