import { siteSnapshotSchema, themeSchema } from "@webforge/model";
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

/** Any job the worker accepts. */
export const workerJobSchema = z.discriminatedUnion("type", [exportJobSchema, compileCssJobSchema]);

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
