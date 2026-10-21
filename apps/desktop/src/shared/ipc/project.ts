import { type SiteDocumentChange, siteDocSchema } from "@webforge/model";
import { z } from "zod";

/** The site (`.wforge` project) that is open in the main process. */
const projectSummarySchema = z.strictObject({
  /** Site name chosen when it was created. */
  name: z.string().min(1),
  /** File name with extension, e.g. `Rosa's Bakery.wforge`; never the full path. */
  fileName: z.string().min(1),
  formatVersion: z.int().positive(),
  /** The cloud sync client watching the site's folder, for the sync-folder warning (ADR 0003). */
  syncService: z.enum(["onedrive", "dropbox", "icloud", "google-drive"]).nullable(),
});

/** The site (`.wforge` project) that is open in the main process. */
export type ProjectSummary = z.infer<typeof projectSummarySchema>;

/**
 * Why a site could not be created or opened. Mirrors `ProjectFileErrorCode` of
 * `@webforge/storage`, plus `unknown` for anything else (e.g. no permission to write the folder).
 */
const projectFailureReasonSchema = z.enum([
  "not-found",
  "not-a-project",
  "corrupt",
  "unexpected-schema",
  "newer-format",
  "unknown",
]);

/** Why a site could not be created or opened. */
export type ProjectFailureReason = z.infer<typeof projectFailureReasonSchema>;

/** Outcome of asking the main process to create or open a site. */
const projectResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("opened"), project: projectSummarySchema }),
  z.strictObject({ status: z.literal("canceled") }),
  z.strictObject({ status: z.literal("failed"), reason: projectFailureReasonSchema }),
]);

/** Outcome of asking the main process to create or open a site. */
export type ProjectResult = z.infer<typeof projectResultSchema>;

/** Outcome of reading the open site's documents. */
const readSiteResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("ok"), site: siteDocSchema }),
  /** No site is open. */
  z.strictObject({ status: z.literal("none") }),
  /** A new site without documents yet; the editor creates its first pages and commits them. */
  z.strictObject({ status: z.literal("empty") }),
  /** The documents don't make a valid site, or use a newer site format. */
  z.strictObject({ status: z.literal("failed"), reason: z.enum(["invalid", "newer-format"]) }),
]);

/** Outcome of reading the open site's documents. */
export type ReadSiteResult = z.infer<typeof readSiteResultSchema>;

/**
 * A change to one of the site's documents (`SiteDocumentChange` of `@webforge/model`). Content is
 * checked in the main process as part of the whole site the changes produce.
 */
const siteDocumentChangeSchema = z.discriminatedUnion("type", [
  z
    .strictObject({
      type: z.literal("put"),
      id: z.string().min(1).max(100),
      kind: z.enum(["site", "settings", "theme", "layout", "media", "code", "menu", "page"]),
      content: z.unknown(),
    })
    // Only documents a site is made of: `page:<id>` pages, every other part under its own name.
    // Anything else would be stored but never read back.
    .refine((change) =>
      change.kind === "page" ? change.id.startsWith("page:") : change.id === change.kind,
    ),
  z.strictObject({ type: z.literal("delete"), id: z.string().regex(/^page:/) }),
]);

/** Outcome of saving changes to the open site. */
const commitResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("saved") }),
  z.strictObject({
    status: z.literal("failed"),
    /** No site open, a read-only site, changes that would break the site, or a write error. */
    reason: z.enum(["no-site", "read-only", "invalid", "unknown"]),
  }),
]);

/** Outcome of saving changes to the open site. */
export type CommitResult = z.infer<typeof commitResultSchema>;

/**
 * The open site's editor state that isn't part of the site (1.10): remembered with the site, but
 * never versioned or undone. Design changes the layout; Content edits text and images only (M3).
 */
const siteUiStateSchema = z.strictObject({ editorMode: z.enum(["design", "content"]) });

/** The open site's editor state that isn't part of the site. */
export type SiteUiState = z.infer<typeof siteUiStateSchema>;

/** Outcome of remembering the editor state with the open site. */
const uiStateResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("saved") }),
  z.strictObject({
    status: z.literal("failed"),
    reason: z.enum(["no-site", "read-only", "unknown"]),
  }),
]);

/** Outcome of remembering the editor state with the open site. */
export type UiStateResult = z.infer<typeof uiStateResultSchema>;

/** A site on the start screen's Recent list (F-SITE-2); its path stays in the main process. */
const recentSiteSchema = z.strictObject({
  id: z.string().regex(/^[0-9a-f]{32}$/),
  name: z.string().min(1),
  fileName: z.string().min(1),
  lastOpened: z.iso.datetime(),
  lastEdited: z.iso.datetime().nullable(),
  /** A JPEG data URL of the canvas when the site was last closed. */
  thumbnail: z
    .string()
    .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/)
    .nullable(),
  /** The file is no longer where it was. */
  missing: z.boolean(),
});

/** A site on the start screen's Recent list. */
export type RecentSite = z.infer<typeof recentSiteSchema>;

/** IPC channels of the `project` domain (`project:*`). */
export const projectChannels = {
  /** Asks where to save a new site (save dialog in main), creates it and makes it current. */
  createProject: {
    channel: "project:create",
    request: z.tuple([]),
    response: projectResultSchema,
  },
  /** Asks which site to open (open dialog in main) and makes it current. */
  openProject: {
    channel: "project:open",
    request: z.tuple([]),
    response: projectResultSchema,
  },
  /** The site that is open, or `null`. */
  getCurrentProject: {
    channel: "project:get-current",
    request: z.tuple([]),
    response: projectSummarySchema.nullable(),
  },
  /** The open site's documents as one validated `SiteDoc`, migrated to the current format. */
  readSite: {
    channel: "project:read-site",
    request: z.tuple([]),
    response: readSiteResultSchema,
  },
  /**
   * Saves changed documents of the open site in one transaction (autosave). The main process
   * applies them to the site it holds and saves only if the result is a valid site.
   */
  commitSite: {
    channel: "project:commit",
    request: z.tuple([z.array(siteDocumentChangeSchema).max(10_000)]),
    response: commitResultSchema,
  },
  /** The open site's editor state (Design or Content mode), or `null` without an open site. */
  /** The Recent list, most recently opened first. */
  listRecentSites: {
    channel: "project:list-recent",
    request: z.tuple([]),
    response: z.array(recentSiteSchema),
  },
  /** Opens a site from the Recent list by its id; a missing file is taken off the list. */
  openRecentSite: {
    channel: "project:open-recent",
    request: z.tuple([z.string().regex(/^[0-9a-f]{32}$/)]),
    response: projectResultSchema,
  },
  /** Takes a site off the Recent list; its file is untouched. */
  removeRecentSite: {
    channel: "project:remove-recent",
    request: z.tuple([z.string().regex(/^[0-9a-f]{32}$/)]),
    response: z.null(),
  },
  getUiState: {
    channel: "project:get-ui-state",
    request: z.tuple([]),
    response: siteUiStateSchema.nullable(),
  },
  /** Remembers the editor state with the open site. */
  setUiState: {
    channel: "project:set-ui-state",
    request: z.tuple([siteUiStateSchema]),
    response: uiStateResultSchema,
  },
  /** The renderer's answer to `app:flush`: every change is saved, the window may close. */
  projectFlushed: {
    channel: "project:flushed",
    request: z.tuple([z.int().positive()]),
    response: z.null(),
  },
} as const;

/** `window.webforge.project`. */
export interface ProjectApi {
  /** Shows a save dialog, then creates the site there and opens it. */
  create(): Promise<ProjectResult>;
  /** Shows an open dialog, then opens the chosen site. */
  open(): Promise<ProjectResult>;
  /** The site that is open, or `null`. */
  getCurrent(): Promise<ProjectSummary | null>;
  /** The open site's documents as one validated site. */
  readSite(): Promise<ReadSiteResult>;
  /** Saves changed documents of the open site, e.g. from `changedDocuments(previous, next)`. */
  commit(changes: readonly SiteDocumentChange[]): Promise<CommitResult>;
  /** The open site's editor state (Design or Content mode), or `null` without an open site. */
  getUiState(): Promise<SiteUiState | null>;
  /** The start screen's Recent list. */
  listRecent(): Promise<RecentSite[]>;
  /** Opens a site from the Recent list. */
  openRecent(id: string): Promise<ProjectResult>;
  /** Takes a site off the Recent list. */
  removeRecent(id: string): Promise<null>;
  /** Remembers the editor state with the open site. */
  setUiState(state: SiteUiState): Promise<UiStateResult>;
}
