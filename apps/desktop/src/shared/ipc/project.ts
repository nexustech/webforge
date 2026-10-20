import { z } from "zod";

/** The site (`.wforge` project) that is open in the main process. */
const projectSummarySchema = z.strictObject({
  /** Site name chosen when it was created. */
  name: z.string().min(1),
  /** File name with extension, e.g. `Rosa's Bakery.wforge`; never the full path. */
  fileName: z.string().min(1),
  formatVersion: z.int().positive(),
});

/** The site (`.wforge` project) that is open in the main process. */
export type ProjectSummary = z.infer<typeof projectSummarySchema>;

/**
 * Why a site could not be created or opened. Mirrors `ProjectFileErrorCode` of
 * `@webforge/storage`, plus `unknown` for anything else (e.g. no permission to write the folder).
 */
const projectFailureReasonSchema = z.enum([
  "not-found",
  "not-a-project",
  "corrupt",
  "unexpected-schema",
  "newer-format",
  "unknown",
]);

/** Why a site could not be created or opened. */
export type ProjectFailureReason = z.infer<typeof projectFailureReasonSchema>;

/** Outcome of asking the main process to create or open a site. */
const projectResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("opened"), project: projectSummarySchema }),
  z.strictObject({ status: z.literal("canceled") }),
  z.strictObject({ status: z.literal("failed"), reason: projectFailureReasonSchema }),
]);

/** Outcome of asking the main process to create or open a site. */
export type ProjectResult = z.infer<typeof projectResultSchema>;

/** IPC channels of the `project` domain (`project:*`). */
export const projectChannels = {
  /** Asks where to save a new site (save dialog in main), creates it and makes it current. */
  createProject: {
    channel: "project:create",
    request: z.tuple([]),
    response: projectResultSchema,
  },
  /** Asks which site to open (open dialog in main) and makes it current. */
  openProject: {
    channel: "project:open",
    request: z.tuple([]),
    response: projectResultSchema,
  },
  /** The site that is open, or `null`. */
  getCurrentProject: {
    channel: "project:get-current",
    request: z.tuple([]),
    response: projectSummarySchema.nullable(),
  },
} as const;

/** `window.webforge.project`. */
export interface ProjectApi {
  /** Shows a save dialog, then creates the site there and opens it. */
  create(): Promise<ProjectResult>;
  /** Shows an open dialog, then opens the chosen site. */
  open(): Promise<ProjectResult>;
  /** The site that is open, or `null`. */
  getCurrent(): Promise<ProjectSummary | null>;
}
