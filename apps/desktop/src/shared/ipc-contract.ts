import { z } from "zod";

/** Information about the running app. */
const appInfoSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
});

/** Information about the running app. */
export type AppInfo = z.infer<typeof appInfoSchema>;

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

/**
 * The single list of IPC channels between the renderer and the main process.
 * Each entry names its channel and the zod schemas for the request arguments and the response.
 * The main process validates every incoming request against `request`; no channel exists outside
 * this contract.
 */
export const ipcContract = {
  getAppInfo: {
    channel: "app:get-info",
    request: z.tuple([]),
    response: appInfoSchema,
  },
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

/** Name of an entry in {@link ipcContract}. */
export type IpcName = keyof typeof ipcContract;

/** Arguments the renderer sends for an IPC call. */
export type IpcRequest<N extends IpcName> = z.infer<(typeof ipcContract)[N]["request"]>;

/** Value the main process returns for an IPC call. */
export type IpcResponse<N extends IpcName> = z.infer<(typeof ipcContract)[N]["response"]>;
