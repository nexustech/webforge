import { FILE_MIME_TYPES, IMAGE_MIME_TYPES } from "@webforge/model";
import { z } from "zod";

// Messages between the main process and the storage writer thread (R13b, ADR 0013): an import to
// read, check, hash and store, and what came of it. Both sides parse what they receive.

/** Where an import's bytes come from: a file the main process found (never the renderer), or bytes. */
const importSourceSchema = z.union([
  z.strictObject({ path: z.string().min(1) }),
  z.strictObject({ data: z.custom<Uint8Array>((value) => value instanceof Uint8Array) }),
]);

/** One import into the open site's file at `sitePath`. */
export const storeImportRequestSchema = z.strictObject({
  sitePath: z.string().min(1),
  fileName: z.string().min(1).max(255),
  source: importSourceSchema,
});

/** See {@link storeImportRequestSchema}. */
export type StoreImportRequest = z.infer<typeof storeImportRequestSchema>;

/**
 * What came of an import:
 * - `stored`: its bytes are in the file under `hash`, with what the main process records with them;
 * - `rejected`: Media doesn't take it, and why;
 * - `skipped`: not a file to import, such as a folder or a file that is gone;
 * - `failed`: the file couldn't be written.
 */
export const storeImportOutcomeSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("stored"),
    hash: z.string().regex(/^[0-9a-f]{64}$/),
    size: z.number().int().nonnegative(),
    media: z.discriminatedUnion("kind", [
      z.strictObject({
        kind: z.literal("image"),
        mimeType: z.enum(IMAGE_MIME_TYPES),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      }),
      z.strictObject({ kind: z.literal("file"), mimeType: z.enum(FILE_MIME_TYPES) }),
    ]),
  }),
  z.strictObject({
    status: z.literal("rejected"),
    reason: z.enum(["too-large", "unsupported", "not-text"]),
  }),
  z.strictObject({ status: z.literal("skipped") }),
  z.strictObject({ status: z.literal("failed") }),
]);

/** See {@link storeImportOutcomeSchema}. */
export type StoreImportOutcome = z.infer<typeof storeImportOutcomeSchema>;

/** A request as it crosses to the thread, with the id its answer carries back. */
export const storageWriterMessageSchema = z.strictObject({
  id: z.number().int(),
  request: storeImportRequestSchema,
});

/** An answer from the thread. */
export const storageWriterAnswerSchema = z.strictObject({
  id: z.number().int(),
  outcome: storeImportOutcomeSchema,
});
