import { mediaMetaSchema } from "@webforge/model";
import { z } from "zod";
import { sessionIdSchema } from "./project.js";

/** The largest file Media takes (F-ED-5). */
export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

/** How many files one import takes, so one drop can't hold the main process for long. */
export const MAX_MEDIA_FILES = 50;

/**
 * The most bytes one `media:import` request carries, so a large drop never travels as one huge
 * IPC message; the renderer sends a large drop in several requests.
 */
export const MAX_IMPORT_REQUEST_BYTES = 2 * MAX_MEDIA_BYTES;

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
export const rejectedFileSchema = z.strictObject({
  fileName: z.string().min(1).max(255),
  /** Not a JPEG, PNG or PDF (judged by its bytes), or over 50 MB or 50 megapixels. */
  /** `not-text`: named as plain text or CSV, but not text (another kind of file renamed). */
  reason: z.enum(["unsupported", "too-large", "not-text"]),
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
    /** `stale-session`: another site opened since the renderer loaded (R6). */
    reason: z.enum(["no-site", "stale-session", "read-only", "unknown"]),
  }),
]);

/** Outcome of an import. */
export type MediaImportResult = z.infer<typeof importResultSchema>;

/**
 * Images in Media show in the editor through this scheme, never by file path (1.16):
 * `webforge-media://thumbnail/<hash>` for a preview, `webforge-media://original/<hash>`.
 */
export const MEDIA_SCHEME = "webforge-media";

/** Where the editor shows a Media image: its thumbnail, or its original bytes. */
export function mediaImageUrl(item: { readonly hash: string }, size: "thumbnail" | "original") {
  return `${MEDIA_SCHEME}://${size}/${item.hash}`;
}

/** IPC channels of the `media` domain (`media:*`). */
export const mediaChannels = {
  /** Imports files dropped on Webforge (F-ED-5). */
  importMedia: {
    channel: "media:import",
    request: z.tuple([
      sessionIdSchema,
      z
        .array(droppedFileSchema)
        .min(1)
        .max(MAX_MEDIA_FILES)
        .refine(
          (files) =>
            files.reduce((total, file) => total + file.data.byteLength, 0) <=
            MAX_IMPORT_REQUEST_BYTES,
        ),
    ]),
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
  /** Imports dropped files into the open site's file, if it is still the opening `sessionId` names. */
  import(sessionId: string, files: readonly DroppedFile[]): Promise<MediaImportResult>;
  /** Lets the user pick files to import. */
  choose(): Promise<MediaImportResult>;
}
