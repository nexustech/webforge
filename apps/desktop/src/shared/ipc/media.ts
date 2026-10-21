import { mediaMetaSchema } from "@webforge/model";
import { z } from "zod";

/** The largest file Media takes (F-ED-5). */
export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

/** How many files one import takes, so one drop can't hold the main process for long. */
export const MAX_MEDIA_FILES = 50;

/** A file dropped on Webforge: its name on the user's computer and its bytes, never its path. */
const droppedFileSchema = z.strictObject({
  fileName: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[^/\\]+$/),
  data: z
    .custom<Uint8Array>((value) => value instanceof Uint8Array)
    .refine((data) => data.byteLength <= MAX_MEDIA_BYTES),
});

/** A file dropped on Webforge. */
type DroppedFile = z.infer<typeof droppedFileSchema>;

/** Why a file wasn't imported; the others in the same import still are. */
const rejectedFileSchema = z.strictObject({
  fileName: z.string().min(1).max(255),
  /** Not a JPEG, PNG or PDF (judged by its bytes), or over 50 MB or 50 megapixels. */
  reason: z.enum(["unsupported", "too-large"]),
});

/**
 * Outcome of an import. Each imported file is stored, unmodified, in the open site's file and comes
 * back as a Media item for the renderer to add to the site, as one undoable step. Its `name` is
 * made from the file name; the renderer makes it unique among the site's Media.
 */
const importResultSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("imported"),
    items: z.array(mediaMetaSchema),
    rejected: z.array(rejectedFileSchema),
  }),
  z.strictObject({ status: z.literal("canceled") }),
  z.strictObject({
    status: z.literal("failed"),
    reason: z.enum(["no-site", "read-only", "unknown"]),
  }),
]);

/** Outcome of an import. */
export type MediaImportResult = z.infer<typeof importResultSchema>;

/**
 * Images in Media show in the editor through this scheme, never by file path (1.16):
 * `webforge-media://thumbnail/<hash>` for a preview, `webforge-media://original/<hash>`.
 */
export const MEDIA_SCHEME = "webforge-media";

/** IPC channels of the `media` domain (`media:*`). */
export const mediaChannels = {
  /** Imports files dropped on Webforge (F-ED-5). */
  importMedia: {
    channel: "media:import",
    request: z.tuple([z.array(droppedFileSchema).min(1).max(MAX_MEDIA_FILES)]),
    response: importResultSchema,
  },
  /** Asks for images or PDFs with a native dialog, then imports them. */
  chooseMedia: {
    channel: "media:choose",
    request: z.tuple([]),
    response: importResultSchema,
  },
} as const;

/** `window.webforge.media`. */
export interface MediaApi {
  /** Imports dropped files into the open site's file. */
  import(files: readonly DroppedFile[]): Promise<MediaImportResult>;
  /** Lets the user pick files to import. */
  choose(): Promise<MediaImportResult>;
}
