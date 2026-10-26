import {
  cropSchema,
  FILE_MIME_TYPES,
  focalPointSchema,
  IMAGE_MIME_TYPES,
  mediaNameSchema,
  siteSnapshotSchema,
} from "@webforge/model";
import { z } from "zod";

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

/**
 * What the renderer sends to export the site: its snapshot, and the Media images and documents it
 * may use.
 */
const exportRequestSchema = z.strictObject({
  /** The site, without image or document bytes (the main process fills them in). */
  snapshot: siteSnapshotSchema,
  media: z.array(exportMediaSchema).max(10_000),
  documents: z.array(exportDocumentSchema).max(10_000).optional(),
});

/** What the renderer sends to export the site. */
export type ExportRequest = z.infer<typeof exportRequestSchema>;

/** Why an export failed; the renderer shows a translated message for each. */
const exportFailureReasonSchema = z.enum([
  "folder-not-empty",
  "build-failed",
  "write-failed",
  // A page or its folder is named after a Windows device: `page` says which, to rename (R16).
  "reserved-name",
]);

/** Outcome of exporting the site to a folder. */
const exportResultSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("exported"),
    /** The chosen folder's name; never the full path. */
    folderName: z.string().min(1),
    pages: z.int().nonnegative(),
    files: z.int().nonnegative(),
    warnings: z.int().nonnegative(),
  }),
  z.strictObject({ status: z.literal("canceled") }),
  z.strictObject({
    status: z.literal("failed"),
    reason: exportFailureReasonSchema,
    /** The page to fix, by its title, for `reserved-name`. */
    page: z.string().max(500).optional(),
  }),
]);

/** Outcome of exporting the site to a folder. */
export type ExportResult = z.infer<typeof exportResultSchema>;

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
} as const;

/** `window.webforge.site`. */
export interface SiteApi {
  /** Shows a folder dialog, then builds the site and writes it there. */
  export(request: ExportRequest): Promise<ExportResult>;
}
