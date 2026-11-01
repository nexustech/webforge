import { FILE_MIME_TYPES, IMAGE_MIME_TYPES } from "@webforge/model";
import { z } from "zod";

// Messages between the main process and the storage writer thread (R13b, ADR 0013). An import
// takes two steps: the thread prepares it (reads, checks and hashes the file) while the main
// process goes on using the site's file, then stores it while the main process waits at the store
// gate. Pasted and downloaded files are stored in one step, and so is the clean-up as a site
// closes (#664), each with the gate's exclusive side. Both sides parse what they receive.

/** Where an import's bytes come from: a file the main process found (never the renderer), or bytes. */
const importSourceSchema = z.union([
  z.strictObject({ path: z.string().min(1) }),
  z.strictObject({ data: z.custom<Uint8Array>((value) => value instanceof Uint8Array) }),
]);

/** See {@link importSourceSchema}. */
export type ImportSource = z.infer<typeof importSourceSchema>;

/** What Media learnt of a file it takes: an image and its size, or a document. */
const mediaSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("image"),
    mimeType: z.enum(IMAGE_MIME_TYPES),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  z.strictObject({ kind: z.literal("file"), mimeType: z.enum(FILE_MIME_TYPES) }),
]);

const hashSchema = z.string().regex(/^[0-9a-f]{64}$/);

const bytesSchema = z.custom<Uint8Array>((value) => value instanceof Uint8Array);

/** A Media item's facts, recorded as its asset: what `ProjectStore.putAsset` takes but the bytes. */
const blobAssetSchema = z.strictObject({
  mediaId: z.string().min(1).max(100),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  originalName: z.string().min(1).max(255),
});

/** A message to the thread, with the id its answer carries back. */
export const storageWriterMessageSchema = z.discriminatedUnion("type", [
  /** Read, check and hash a file, and keep its bytes under this message's id. */
  z.strictObject({
    id: z.number().int(),
    type: z.literal("prepare"),
    fileName: z.string().min(1).max(255),
    source: importSourceSchema,
  }),
  /** Store the bytes prepared under `prepared` as Media item `mediaId`'s asset in `sitePath`. */
  z.strictObject({
    id: z.number().int(),
    type: z.literal("store"),
    prepared: z.number().int(),
    sitePath: z.string().min(1),
    mediaId: z.string().min(1).max(100),
    originalName: z.string().min(1).max(255),
  }),
  /** Forget the bytes prepared under `prepared`: the import goes no further. */
  z.strictObject({ id: z.number().int(), type: z.literal("discard"), prepared: z.number().int() }),
  /**
   * Store these files' bytes in `sitePath`, all or none: a pasted Media item's, as its asset when
   * `asset` says so, or the files the site's code downloaded (3.9).
   */
  z.strictObject({
    id: z.number().int(),
    type: z.literal("put-blobs"),
    sitePath: z.string().min(1),
    blobs: z
      .array(z.strictObject({ data: bytesSchema, mime: z.string().min(1).max(255) }))
      .min(1)
      .max(1000),
    asset: blobAssetSchema.optional(),
  }),
  /** Clean `sitePath` up as its site closes: garbage collection, then VACUUM when it pays. */
  z.strictObject({
    id: z.number().int(),
    type: z.literal("clean-up"),
    sitePath: z.string().min(1),
  }),
]);

/** See {@link storageWriterMessageSchema}. */
export type StorageWriterMessage = z.infer<typeof storageWriterMessageSchema>;

/**
 * What came of preparing an import:
 * - `prepared`: the thread holds its bytes, which hash to `hash`, for storing;
 * - `rejected`: Media doesn't take it, and why;
 * - `skipped`: not a file to import, such as a folder, a pipe, or a file that is gone;
 * - `failed`: it couldn't be read.
 */
const prepareOutcomeSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("prepared"),
    hash: hashSchema,
    size: z.number().int().nonnegative(),
    media: mediaSchema,
  }),
  z.strictObject({
    status: z.literal("rejected"),
    reason: z.enum(["too-large", "unsupported", "not-text"]),
  }),
  z.strictObject({ status: z.literal("skipped") }),
  z.strictObject({ status: z.literal("failed") }),
]);

/** See {@link prepareOutcomeSchema}. */
export type PrepareOutcome = z.infer<typeof prepareOutcomeSchema>;

/** What came of storing a prepared import: in the file as the item's asset, or not. */
const storeOutcomeSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("stored") }),
  z.strictObject({ status: z.literal("failed") }),
]);

/** See {@link storeOutcomeSchema}. */
export type StoreOutcome = z.infer<typeof storeOutcomeSchema>;

/** What came of storing files' bytes: their hashes, in order, or not stored. */
const putBlobsOutcomeSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("put"), hashes: z.array(hashSchema) }),
  z.strictObject({ status: z.literal("failed") }),
]);

/** See {@link putBlobsOutcomeSchema}. */
export type PutBlobsOutcome = z.infer<typeof putBlobsOutcomeSchema>;

/** What came of cleaning a site's file up: what it removed and whether it shrank, or not. */
const cleanUpOutcomeSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("cleaned"),
    blobs: z.number().int().nonnegative(),
    bytes: z.number().int().nonnegative(),
    assets: z.number().int().nonnegative(),
    vacuumed: z.boolean(),
  }),
  z.strictObject({ status: z.literal("failed") }),
]);

/** See {@link cleanUpOutcomeSchema}. */
export type CleanUpOutcome = z.infer<typeof cleanUpOutcomeSchema>;

/** An answer from the thread, to the message with its id. */
export const storageWriterAnswerSchema = z.strictObject({
  id: z.number().int(),
  outcome: z.union([
    prepareOutcomeSchema,
    storeOutcomeSchema,
    putBlobsOutcomeSchema,
    cleanUpOutcomeSchema,
  ]),
});
