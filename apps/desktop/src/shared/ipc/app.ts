import { languageTagSchema } from "@webforge/model";
import { z } from "zod";
import {
  type ErrorDetails,
  errorDetailsSchema,
  type RendererErrorKind,
  rendererErrorKindSchema,
} from "../error-details.js";

/** Information about the running app. */
const appInfoSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
});

/** Information about the running app. */
export type AppInfo = z.infer<typeof appInfoSchema>;

/** Where a handled failure happened, by area and action: `clipboard.paste`, `command.edit.undo`. */
const failureContextSchema = z.string().regex(/^[a-z][a-zA-Z0-9.-]{0,63}$/);

/** An error as `errorCode` gives it: a name, and maybe a code (`Error ENOENT`), or a type. */
const failureCodeSchema = z.string().regex(/^[A-Za-z0-9_.:-]{1,64}(?: [A-Za-z0-9_.:-]{1,64})?$/);

/** A command's id, as the renderer's registry names it (`edit.undo`, `site.settings`). */
const commandIdSchema = z.string().regex(/^[a-z][a-zA-Z0-9.-]{0,63}$/);

/** One item of a native menu: the renderer's command, as its menus show it (LF-13). */
const nativeMenuItemSchema = z.strictObject({
  id: commandIdSchema,
  label: z.string().min(1).max(80),
  /** Its shortcut as Electron writes accelerators (`CmdOrCtrl+Shift+Z`), shown only. */
  accelerator: z.string().max(40).optional(),
  enabled: z.boolean(),
});

/** The renderer's menus (File, Edit, View, Help), for macOS's menu bar (LF-13). */
export const nativeMenusSchema = z
  .array(
    z.strictObject({
      id: z.enum(["file", "edit", "view", "help"]),
      label: z.string().min(1).max(40),
      items: z.array(nativeMenuItemSchema).max(100),
    }),
  )
  .max(4);

/** The renderer's menus, as macOS's menu bar shows them. */
export type NativeMenus = z.infer<typeof nativeMenusSchema>;

/** IPC channels of the `app` domain (`app:*`). */
export const appChannels = {
  getAppInfo: {
    channel: "app:get-info",
    request: z.tuple([]),
    response: appInfoSchema,
  },
  /** Shows the local crash-reports folder in Explorer or Finder (Help menu, F-SITE-7). */
  openCrashReports: {
    channel: "app:open-crash-reports",
    request: z.tuple([]),
    response: z.null(),
  },
  /**
   * Writes a local crash report of an error in the renderer (R3, F-SITE-7): how it surfaced, the
   * error's name and its stack frames, never its message.
   */
  reportError: {
    channel: "app:report-error",
    request: z.tuple([rendererErrorKindSchema, errorDetailsSchema]),
    response: z.null(),
  },
  /**
   * Logs a failure the renderer handled (R12): where it happened and the error's name and code,
   * never its message (`errorCode`). Both are short plain tokens.
   */
  logFailure: {
    channel: "app:log-failure",
    request: z.tuple([failureContextSchema, failureCodeSchema]),
    response: z.null(),
  },
  /**
   * Shows the renderer's menus in macOS's menu bar (LF-13): on macOS the window has no menus of its
   * own. Elsewhere it does nothing.
   */
  setNativeMenus: {
    channel: "app:set-native-menus",
    request: z.tuple([nativeMenusSchema]),
    response: z.null(),
  },
  /** Spell checks text in the site's language (F-ED-19); Windows only, macOS chooses itself. */
  setSpellCheckLanguage: {
    channel: "app:set-spellcheck-language",
    request: z.tuple([languageTagSchema]),
    response: z.null(),
  },
} as const;

/**
 * Messages the main process sends to the renderer (the only direction `invoke` can't cover). Each
 * names its channel and the schema of its arguments, which the preload script checks.
 */
export const appEvents = {
  /**
   * The window is closing: save now. The argument is a request id; the renderer answers with
   * `project:flushed` and that id once everything is saved.
   */
  flushRequest: { channel: "app:flush", args: z.tuple([z.int().positive()]) },
  /** An item of macOS's menu bar was chosen: run the renderer's command with this id (LF-13). */
  runCommand: { channel: "app:run-command", args: z.tuple([commandIdSchema]) },
} as const;

/** `window.webforge.app`. */
export interface AppApi {
  /** Returns the app name and version. */
  getInfo(): Promise<AppInfo>;
  /** Shows the local crash-reports folder. */
  openCrashReports(): Promise<null>;
  /** Writes a local crash report of a renderer error: its name and frames only. */
  reportError(kind: RendererErrorKind, error: ErrorDetails): Promise<null>;
  /** Logs a handled failure: where (`clipboard.paste`) and the error's name and code only. */
  logFailure(context: string, code: string): Promise<null>;
  /** Spell checks text in `language`, the site's (a language tag such as `en-GB`). */
  setSpellCheckLanguage(language: string): Promise<null>;
  /** Shows `menus` in macOS's menu bar; nothing elsewhere. */
  setNativeMenus(menus: NativeMenus): Promise<null>;
  /** Runs `run` with a command's id whenever it is chosen in macOS's menu bar. */
  onRunCommand(run: (id: string) => void): () => void;
  /**
   * Runs `save` whenever the window is about to close, and tells the main process once it has
   * finished (or failed), so the window can close. Returns a function that stops listening.
   */
  onFlushRequest(save: () => Promise<void>): () => void;
}
