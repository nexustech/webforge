import type { z } from "zod";
import { appChannels } from "./ipc/app.js";
import { projectChannels } from "./ipc/project.js";
import { siteChannels } from "./ipc/site.js";

export type { AppInfo } from "./ipc/app.js";
export type { ProjectFailureReason, ProjectResult, ProjectSummary } from "./ipc/project.js";
export type { ExportResult } from "./ipc/site.js";

/**
 * The single list of IPC channels between the renderer and the main process.
 * Each entry names its channel and the zod schemas for the request arguments and the response.
 * The main process validates every incoming request against `request`; no channel exists outside
 * this contract.
 *
 * Each domain keeps its schemas and channels in its own file under `./ipc/` (file name = channel
 * prefix = `window.webforge` key), so a new domain adds a file and one line in each object below.
 */
export const ipcContract = {
  ...appChannels,
  ...projectChannels,
  ...siteChannels,
} as const;

/** The channels of each domain, keyed by domain; the tests check none overwrites another. */
export const ipcDomains = {
  app: appChannels,
  project: projectChannels,
  site: siteChannels,
} as const;

/** Name of an entry in {@link ipcContract}. */
export type IpcName = keyof typeof ipcContract;

/** Arguments the renderer sends for an IPC call. */
export type IpcRequest<N extends IpcName> = z.infer<(typeof ipcContract)[N]["request"]>;

/** Value the main process returns for an IPC call. */
export type IpcResponse<N extends IpcName> = z.infer<(typeof ipcContract)[N]["response"]>;
