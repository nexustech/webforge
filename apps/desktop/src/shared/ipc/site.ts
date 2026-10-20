import { type SiteSnapshot, siteSnapshotSchema } from "@webforge/model";
import { z } from "zod";

/** Why an export failed; the renderer shows a translated message for each. */
const exportFailureReasonSchema = z.enum(["folder-not-empty", "build-failed", "write-failed"]);

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
  z.strictObject({ status: z.literal("failed"), reason: exportFailureReasonSchema }),
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
    request: z.tuple([siteSnapshotSchema]),
    response: exportResultSchema,
  },
} as const;

/** `window.webforge.site`. */
export interface SiteApi {
  /** Shows a folder dialog, then builds the site and writes it there. */
  export(snapshot: SiteSnapshot): Promise<ExportResult>;
}
