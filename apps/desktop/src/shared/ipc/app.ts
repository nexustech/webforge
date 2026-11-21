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

/** The menus macOS's menu bar takes from the renderer: the application menu (`app`), then five. */
const NATIVE_MENU_KINDS = ["app", "file", "edit", "view", "site", "help"] as const;

/** One item of a native submenu: the renderer's command, as its menus show it (3.18). */
const nativeSubmenuItemSchema = z.strictObject({
  id: commandIdSchema,
  label: z.string().min(1).max(80),
  /** Its shortcut as Electron writes accelerators (`CmdOrCtrl+Shift+Z`), shown only. */
  accelerator: z.string().max(40).optional(),
  enabled: z.boolean(),
  /** Why it's disabled, already translated (#1010): shown under its label. */
  reason: z.string().min(1).max(120).optional(),
  /** After a separator: Clear Recent at the foot of Open Recent, or a menu's next group (#1016). */
  separated: z.literal(true).optional(),
});

/**
 * One item of a native menu: the renderer's command, as its menus show it (LF-13), or the item
 * that opens a submenu of them (File › Open Recent, 3.18). Submenus go one level deep.
 */
const nativeMenuItemSchema = nativeSubmenuItemSchema.extend({
  submenu: z.array(nativeSubmenuItemSchema).min(1).max(20).optional(),
});

/** The renderer's menus (File, Edit, View, Site, Help), for macOS's menu bar (LF-13). */
const nativeMenusSchema = z
  .array(
    z.strictObject({
      // `app`: the application menu, macOS's first (Webforge › Settings…).
      id: z.enum(NATIVE_MENU_KINDS),
      label: z.string().min(1).max(40),
      items: z.array(nativeMenuItemSchema).max(100),
    }),
  )
  // One of each kind at most.
  .max(NATIVE_MENU_KINDS.length);

/** The renderer's menus, as macOS's menu bar shows them. */
export type NativeMenus = z.infer<typeof nativeMenusSchema>;

/**
 * The pages on other websites Site Check's guides open (3.17, SEO-7), by name: main knows their
 * fixed addresses, so the renderer can't open any other.
 */
const GUIDES = ["businessProfile", "searchConsole"] as const;

/** One of {@link GUIDES}. */
export type Guide = (typeof GUIDES)[number];

/** One package the app ships, as the Open-Source Licences screen lists it (5.3, C1). */
const noticeSchema = z.strictObject({
  name: z.string().min(1).max(214),
  version: z.string().min(1).max(256),
  /** Its licence, as its package names it: an SPDX expression, usually. */
  licence: z.string().min(1).max(500),
  /** Its home page or repository. */
  homepage: z
    .url({ protocol: /^https?$/ })
    .max(2048)
    .optional(),
  /** Its licence and notice files, as the package ships them. */
  text: z.string().max(500_000).optional(),
});

/** One package the app ships, with its licence. */
export type Notice = z.infer<typeof noticeSchema>;

/**
 * The third-party notices the build writes beside the app (`notices/notices.json`, 5.3): every
 * package it ships, by name.
 */
export const noticesFileSchema = z.strictObject({
  packages: z.array(noticeSchema).max(5000),
});

/** The app's packages and their licences; `failed` when the notices couldn't be read. */
const licencesResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("listed"), packages: noticesFileSchema.shape.packages }),
  z.strictObject({ status: z.literal("failed") }),
]);

/** What `listLicences` gives. */
export type LicencesResult = z.infer<typeof licencesResultSchema>;

/** The longest message Report a Problem takes (OL-10): a few paragraphs, as a form takes them. */
export const REPORT_TEXT_MAX = 6000;

/** Where Report a Problem sends a report from (OL-10): a GitHub issue, or an email. */
const reportRouteSchema = z.enum(["issue", "mail"]);

/** Where Report a Problem can send a report from (OL-10), and what it is sent with. */
const reportInfoSchema = z.strictObject({
  /** The app's version, as the report gives it. */
  version: z.string().min(1).max(100),
  /** The computer's system, as the report gives it: "Windows 10.0.26300 (x64)". */
  system: z.string().min(1).max(200),
  /** Whether a report can be emailed: once the beta has an address (Q7). */
  mail: z.boolean(),
});

/** See {@link reportInfoSchema}. */
export type ReportInfo = z.infer<typeof reportInfoSchema>;

/** What became of opening a report in the browser or mail app. */
/** `cut`: opened, but the message was shortened to fit the address, so the rest is to be pasted. */
const reportOpenedSchema = z.enum(["opened", "cut", "failed", "unavailable"]);

/** A screenshot of the editor's window (OL-10): shown small to the person, kept in main to save. */
const windowCaptureSchema = z.union([
  z.strictObject({
    status: z.literal("captured"),
    /** A smaller copy, as a JPEG data URL, for the dialog to show. */
    preview: z
      .string()
      .startsWith("data:image/jpeg;base64,")
      .max(4 * 1024 * 1024),
  }),
  z.strictObject({ status: z.literal("failed") }),
]);

/** See {@link windowCaptureSchema}. */
type WindowCapture = z.infer<typeof windowCaptureSchema>;

/** What became of saving the screenshot. */
const captureSavedSchema = z.enum(["saved", "cancelled", "failed", "none"]);

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
  /**
   * Opens a guide's page in the default browser (3.17): Google Business Profile or Search
   * Console. `false` when the browser couldn't be opened.
   */
  openGuide: {
    channel: "app:open-guide",
    request: z.tuple([z.enum(GUIDES)]),
    response: z.boolean(),
  },
  /**
   * The packages the app ships and their licences (5.3, C1), from the notices its build wrote
   * beside it, for Help → Open-Source Licences.
   */
  listLicences: {
    channel: "app:list-licences",
    request: z.tuple([]),
    response: licencesResultSchema,
  },
  /**
   * Opens Chromium's own licences, which Electron ships as LICENSES.chromium.html, in the default
   * browser: a fixed file of the app's. `false` when it couldn't be opened.
   */
  openChromiumLicences: {
    channel: "app:open-chromium-licences",
    request: z.tuple([]),
    response: z.boolean(),
  },
  /** Spell checks text in the site's language (F-ED-19); Windows only, macOS chooses itself. */
  setSpellCheckLanguage: {
    channel: "app:set-spellcheck-language",
    request: z.tuple([languageTagSchema]),
    response: z.null(),
  },
  /** What Report a Problem sends with a report, and where it can (OL-10). */
  getReportInfo: {
    channel: "app:get-report-info",
    request: z.tuple([]),
    response: reportInfoSchema,
  },
  /**
   * Opens a report for the person to send themself (OL-10): a new GitHub issue in their browser,
   * or an email in their mail app, filled in with the message, the version and the system. Main
   * builds the address: the renderer names where, never an address. Nothing is sent from here.
   */
  openReport: {
    channel: "app:open-report",
    request: z.tuple([reportRouteSchema, z.string().max(REPORT_TEXT_MAX)]),
    response: reportOpenedSchema,
  },
  /** Takes a screenshot of the editor's window, only when the person asks (OL-10). */
  captureWindow: {
    channel: "app:capture-window",
    request: z.tuple([]),
    response: windowCaptureSchema,
  },
  /** Saves the screenshot taken, where the person chooses, for them to attach (OL-10). */
  saveWindowCapture: {
    channel: "app:save-window-capture",
    request: z.tuple([]),
    response: captureSavedSchema,
  },
  /** Forgets the screenshot taken: the dialog has closed, or the person removed it. */
  discardWindowCapture: {
    channel: "app:discard-window-capture",
    request: z.tuple([]),
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
  /**
   * The site is being left (closed, or another opened): draw its home page for its picture in the
   * Recent list (`draw`, #1175), answered with `project:site-picture-drawn` and the request id; or
   * take that drawing away again (`done`), once the picture is taken or given up on.
   */
  sitePicture: {
    channel: "app:site-picture",
    args: z.tuple([z.int().positive(), z.enum(["draw", "done"])]),
  },
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
  /** The packages the app ships and their licences. */
  listLicences(): Promise<LicencesResult>;
  /** Opens Chromium's licences in the default browser; `false` when it couldn't. */
  openChromiumLicences(): Promise<boolean>;
  /** Opens `guide`'s page in the default browser; `false` when it couldn't. */
  openGuide(guide: Guide): Promise<boolean>;
  /** Spell checks text in `language`, the site's (a language tag such as `en-GB`). */
  setSpellCheckLanguage(language: string): Promise<null>;
  /** What Report a Problem sends with a report, and where it can (OL-10). */
  getReportInfo(): Promise<ReportInfo>;
  /** Opens a report of `text` as a new GitHub issue or an email, for the person to send. */
  openReport(
    route: "issue" | "mail",
    text: string,
  ): Promise<"opened" | "cut" | "failed" | "unavailable">;
  /** Takes a screenshot of the editor's window. */
  captureWindow(): Promise<WindowCapture>;
  /** Saves the screenshot taken, where the person chooses. */
  saveWindowCapture(): Promise<"saved" | "cancelled" | "failed" | "none">;
  /** Forgets the screenshot taken. */
  discardWindowCapture(): Promise<null>;
  /** Shows `menus` in macOS's menu bar; nothing elsewhere. */
  setNativeMenus(menus: NativeMenus): Promise<null>;
  /** Runs `run` with a command's id whenever it is chosen in macOS's menu bar. */
  onRunCommand(run: (id: string) => void): () => void;
  /**
   * Runs `save` whenever the window is about to close, and tells the main process once it has
   * finished (or failed), so the window can close. Returns a function that stops listening.
   */
  onFlushRequest(save: () => Promise<void>): () => void;
  /**
   * Runs `draw` when the site is being left, to draw its home page where the window's picture of it
   * is taken (#1175), and tells the main process whether it did; runs `done` once the picture is
   * taken. Returns a function that stops listening.
   */
  onSitePicture(draw: () => Promise<boolean>, done: () => void): () => void;
}
