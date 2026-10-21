import { IMAGE_MIME_TYPES, siteSnapshotSchema, themeSchema } from "@webforge/model";
import { z } from "zod";

/** What the main process asks the export worker to do. */
const exportJobSchema = z.strictObject({
  type: z.literal("export"),
  snapshot: siteSnapshotSchema,
  /** Absolute path of the folder to write; chosen by the user in a native dialog. */
  destination: z.string().min(1),
});

/** What the main process asks the export worker to do. */
export type ExportJob = z.infer<typeof exportJobSchema>;

/** Compiles the site CSS for the canvas; a long-lived worker answers many of these (1.12). */
const compileCssJobSchema = z.strictObject({
  type: z.literal("compile-css"),
  /** Matches the answer to the request. */
  id: z.int().nonnegative(),
  theme: themeSchema,
  candidates: z.array(z.string()),
});

/** Compiles the site CSS for the canvas. */
export type CompileCssJob = z.infer<typeof compileCssJobSchema>;

/** Bytes of any buffer kind (a Node `Buffer` too), which `z.instanceof` would narrow. */
const bytesSchema = z.custom<Uint8Array>((value) => value instanceof Uint8Array);

/** Makes the editor's preview of a Media image (1.16); a long-lived worker answers many. */
const thumbnailJobSchema = z.strictObject({
  type: z.literal("thumbnail"),
  id: z.int().nonnegative(),
  mimeType: z.enum(IMAGE_MIME_TYPES),
  /** The original's bytes. */
  data: bytesSchema,
});

/** Makes the editor's preview of a Media image. */
export type ThumbnailJob = z.infer<typeof thumbnailJobSchema>;

/** Any job the worker accepts. */
export const workerJobSchema = z.discriminatedUnion("type", [
  exportJobSchema,
  compileCssJobSchema,
  thumbnailJobSchema,
]);

/** The worker's answer to a {@link ThumbnailJob}: a WebP, or a failure without details. */
export const thumbnailOutcomeSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("thumbnail"),
    id: z.int().nonnegative(),
    data: bytesSchema,
  }),
  z.strictObject({ type: z.literal("thumbnail-failed"), id: z.int().nonnegative() }),
]);

/** The worker's answer to a {@link ThumbnailJob}. */
export type ThumbnailOutcome = z.infer<typeof thumbnailOutcomeSchema>;

/** The worker's answer to a {@link CompileCssJob}. */
export const compileCssOutcomeSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("css"),
    id: z.int().nonnegative(),
    css: z.string(),
    bodyClass: z.string(),
  }),
  z.strictObject({ type: z.literal("css-failed"), id: z.int().nonnegative() }),
]);

/** The worker's answer to a {@link CompileCssJob}. */
export type CompileCssOutcome = z.infer<typeof compileCssOutcomeSchema>;

/**
 * What the export worker reports back. Failures carry only a code: no paths, no site content
 * (standards §4, logging).
 */
export const exportOutcomeSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("exported"),
    pages: z.int().nonnegative(),
    files: z.int().nonnegative(),
    bytes: z.int().nonnegative(),
    warnings: z.int().nonnegative(),
    durationMs: z.number().nonnegative(),
  }),
  z.strictObject({
    type: z.literal("failed"),
    code: z.enum(["folder-not-empty", "write-failed", "build-failed"]),
    /** A machine-readable detail such as a BuildError code; safe to log. */
    detail: z.string(),
  }),
]);

/** What the export worker reports back. */
export type ExportOutcome = z.infer<typeof exportOutcomeSchema>;
