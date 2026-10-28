import {
  bundledFileSchema,
  cropSchema,
  exportChoicesSchema,
  FILE_MIME_TYPES,
  focalPointSchema,
  IMAGE_MIME_TYPES,
  mediaNameSchema,
  siteSnapshotSchema,
} from "@webforge/model";
import { z } from "zod";
import { sessionIdSchema } from "./project.js";

/**
 * An image the export needs, named by its hash: the main process reads its bytes from the open
 * site's file, so up to 50 MB per image never travels from the renderer (1.16).
 */
const exportMediaSchema = z.strictObject({
  id: z.string().regex(/^[A-Za-z0-9_-]+$/),
  name: mediaNameSchema,
  mimeType: z.enum(IMAGE_MIME_TYPES),
  hash: z.string().regex(/^[0-9a-f]{64}$/),
  alt: z.string(),
  focal: focalPointSchema.optional(),
  crop: cropSchema.optional(),
});

/** A document pages link to (1.28), named by its hash like images; copied to `files/` unchanged. */
const exportDocumentSchema = z.strictObject({
  id: z.string().regex(/^[A-Za-z0-9_-]+$/),
  name: mediaNameSchema,
  mimeType: z.enum(FILE_MIME_TYPES),
  hash: z.string().regex(/^[0-9a-f]{64}$/),
});

import type { ExportChoices } from "@webforge/model";

export type { ExportChoices };

/**
 * What the renderer sends to export the site: its snapshot, the Media images and documents it may
 * use, the person's choices to remember with the site, and what this export writes. The two differ
 * where an option isn't offered: Simple mode never writes developer files, but keeps the choice
 * Advanced mode made (3.3).
 */
const exportRequestSchema = z.strictObject({
  /** The site, without image or document bytes (the main process fills them in). */
  snapshot: siteSnapshotSchema,
  media: z.array(exportMediaSchema).max(10_000),
  documents: z.array(exportDocumentSchema).max(10_000).optional(),
  choices: exportChoicesSchema,
  /** *Minify output* and *Include developer files*, as this export applies them. */
  output: z.strictObject({ minify: z.boolean(), developerFiles: z.boolean() }),
});

/** What the renderer sends to export the site. */
export type ExportRequest = z.infer<typeof exportRequestSchema>;

/**
 * The site as a build takes it from the renderer: its snapshot, and the images and documents it
 * may use by hash. The preview (3.2) sends this; an export adds the person's choices.
 */
export const siteContentSchema = exportRequestSchema.pick({
  snapshot: true,
  media: true,
  documents: true,
});

/** The site as a build takes it from the renderer. */
export type SiteContent = z.infer<typeof siteContentSchema>;

/** Why an export failed; the renderer shows a translated message for each. */
const exportFailureReasonSchema = z.enum([
  "folder-not-empty",
  "build-failed",
  "write-failed",
  // A page or its folder is named after a Windows device: `page` says which, to rename (R16).
  "reserved-name",
  // Too large for a ZIP file (3.3): a folder takes it.
  "too-large",
]);

/**
 * A problem the export found that didn't stop it (X5), for the export report: a link to a page or
 * file that isn't there, or an image deleted from Media. `page` is the page's path ("" for the
 * whole site); `detail` what the link pointed at, or the image's id. `not-minified`: *Minify
 * output* left the page readable. `missing-icon`, `small-icon`: the site icon gave no favicon.
 * `custom-script`: the site's `custom.js` has a mistake; `detail` is its line (3.9).
 */
export const exportWarningSchema = z.strictObject({
  code: z.enum([
    "broken-link",
    "missing-image",
    "not-minified",
    "missing-icon",
    "small-icon",
    "form-unset",
    "custom-script",
    "missing-kept-file",
  ]),
  page: z.string().max(1024),
  detail: z.string().max(2048),
});

/** At most this many warnings reach the report; it says how many more there were. */
export const MAX_REPORTED_WARNINGS = 500;

/** Outcome of exporting the site to a folder or a ZIP. */
const exportResultSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("exported"),
    format: z.enum(["folder", "zip"]),
    /** The chosen folder's or ZIP file's name; never the full path. */
    name: z.string().min(1),
    pages: z.int().nonnegative(),
    files: z.int().nonnegative(),
    /** The site's size, before a ZIP compresses it. */
    bytes: z.int().nonnegative(),
    warnings: z.array(exportWarningSchema).max(MAX_REPORTED_WARNINGS),
    /** How many warnings there were, those left out of `warnings` included. */
    warningCount: z.int().nonnegative(),
  }),
  z.strictObject({ status: z.literal("canceled") }),
  z.strictObject({
    status: z.literal("failed"),
    reason: exportFailureReasonSchema,
    /** The page to fix, by its title, for `reserved-name`. */
    page: z.string().max(500).optional(),
  }),
]);

/** Outcome of exporting the site to a folder or a ZIP. */
export type ExportResult = z.infer<typeof exportResultSchema>;

/**
 * How far an export has come (3.1): the stage it has started, and for images and pages which one
 * (from 0) of how many. `writing` is the folder being written.
 */
export const exportProgressSchema = z.discriminatedUnion("stage", [
  z.strictObject({
    stage: z.enum(["images", "pages"]),
    done: z.int().nonnegative(),
    total: z.int().nonnegative(),
  }),
  z.strictObject({ stage: z.enum(["styles", "fonts", "writing"]) }),
]);

/** How far an export has come. */
export type ExportProgress = z.infer<typeof exportProgressSchema>;

/** The most files a stylesheet kept with the site may name, downloaded with it (3.9). */
export const BUNDLE_MAX_NESTED = 30;

/**
 * What came of Download and bundle (C8, 3.9): the files to keep with the site, the asked-for one
 * first and then those it names if it's a stylesheet, their bytes stored in the site file; or why
 * not. See `DownloadFailure` in main's bundle-download.ts; the rest are the site's own reasons.
 */
const bundleResultSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("bundled"),
    files: z
      .array(bundledFileSchema)
      .min(1)
      .max(BUNDLE_MAX_NESTED + 1),
  }),
  z.strictObject({
    status: z.literal("failed"),
    reason: z.enum([
      "not-https",
      "local",
      "offline",
      "not-found",
      "too-large",
      "not-a-file",
      "no-site",
      "stale-session",
      "read-only",
      "unknown",
    ]),
  }),
]);

/** What came of Download and bundle. */
export type BundleResult = z.infer<typeof bundleResultSchema>;

/** IPC channels of the `site` domain (`site:*`). */
export const siteChannels = {
  /**
   * Asks for a folder (open dialog in main), builds the site in a utility process and writes it
   * there (export pipeline, 07).
   */
  exportSite: {
    channel: "site:export",
    request: z.tuple([exportRequestSchema]),
    response: exportResultSchema,
  },
  /** What the person chose for the open site's last export: the defaults until there was one. */
  exportChoices: {
    channel: "site:export-choices",
    request: z.tuple([]),
    response: exportChoicesSchema,
  },
  /**
   * Remembers the person's export choices with the open site at once (3.3): *Don't ask again for
   * this site* holds even if the export that follows is cancelled.
   */
  setExportChoices: {
    channel: "site:set-export-choices",
    request: z.tuple([exportChoicesSchema]),
    response: z.null(),
  },
  /**
   * *Preview from disk* (07): opens the open site's last export, its home page in the default
   * browser or its ZIP file in the file manager. `none` when this site hasn't been exported since
   * it opened; `missing` when the export was moved or deleted since.
   */
  openExport: {
    channel: "site:open-export",
    request: z.tuple([]),
    response: z.enum(["opened", "none", "missing"]),
  },
  /**
   * Cancels the export under way, if there is one (3.1): it stops before its next image or page
   * and answers `canceled`, changing nothing on disk.
   */
  cancelExport: {
    channel: "site:cancel-export",
    request: z.tuple([]),
    response: z.null(),
  },
  /**
   * Download and bundle (C8, 3.9): downloads the file at an address the site's code names, on the
   * person's click only, and stores it in the open site's file, if it is still the opening
   * `sessionId` names. The renderer then keeps it in the site's code, as one undo step.
   */
  bundleFile: {
    channel: "site:bundle-file",
    request: z.tuple([sessionIdSchema, z.string().max(2048)]),
    response: bundleResultSchema,
  },
} as const;

/** Messages the main process sends to the renderer in the `site` domain. */
export const siteEvents = {
  /** How far the export under way has come. */
  exportProgress: { channel: "site:export-progress", args: z.tuple([exportProgressSchema]) },
} as const;

/** `window.webforge.site`. */
export interface SiteApi {
  /** Shows a folder or save dialog, then builds the site and writes it there. */
  export(request: ExportRequest): Promise<ExportResult>;
  /** What the person chose for the open site's last export. */
  exportChoices(): Promise<ExportChoices>;
  /** Remembers the person's export choices with the open site. */
  setExportChoices(choices: ExportChoices): Promise<null>;
  /** Opens the open site's last export from disk. */
  openExport(): Promise<"opened" | "none" | "missing">;
  /** Cancels the export under way, if there is one. */
  cancelExport(): Promise<null>;
  /** Downloads the file at `url` to keep with the site opened as `sessionId`. */
  bundleFile(sessionId: string, url: string): Promise<BundleResult>;
  /** Tells `listener` how far exports come, until the returned function is called. */
  onExportProgress(listener: (progress: ExportProgress) => void): () => void;
}
