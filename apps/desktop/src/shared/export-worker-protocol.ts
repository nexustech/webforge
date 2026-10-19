import { siteSnapshotSchema } from "@webforge/model";
import { z } from "zod";

/** What the main process asks the export worker to do. */
export const exportJobSchema = z.strictObject({
  type: z.literal("export"),
  snapshot: siteSnapshotSchema,
  /** Absolute path of the folder to write; chosen by the user in a native dialog. */
  destination: z.string().min(1),
});

/** What the main process asks the export worker to do. */
export type ExportJob = z.infer<typeof exportJobSchema>;

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
