import type { z } from "zod";
import { aiChannels } from "./ipc/ai.js";
import { appChannels } from "./ipc/app.js";
import { canvasChannels } from "./ipc/canvas.js";
import { clipboardChannels } from "./ipc/clipboard.js";
import { fontsChannels } from "./ipc/fonts.js";
import { mediaChannels } from "./ipc/media.js";
import { prefsChannels } from "./ipc/prefs.js";
import { previewChannels } from "./ipc/preview.js";
import { projectChannels } from "./ipc/project.js";
import { publishChannels } from "./ipc/publish.js";
import { siteChannels } from "./ipc/site.js";
import { templatesChannels } from "./ipc/templates.js";
import { themesChannels } from "./ipc/themes.js";

export type { AppInfo } from "./ipc/app.js";
export type { MediaImportResult } from "./ipc/media.js";
export type { Preferences, PreferencesChange } from "./ipc/prefs.js";
export type {
  CommitResult,
  ProjectFailureReason,
  ProjectResult,
  ProjectSummary,
  ReadSiteResult,
  RecentSite,
  SaveSiteZipResult,
  SiteUiChange,
  SiteUiState,
  UiStateResult,
} from "./ipc/project.js";
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
  ...canvasChannels,
  ...clipboardChannels,
  ...fontsChannels,
  ...mediaChannels,
  ...prefsChannels,
  ...projectChannels,
  ...siteChannels,
  ...templatesChannels,
  ...aiChannels,
  ...themesChannels,
  ...previewChannels,
  ...publishChannels,
} as const;

/** The channels of each domain, keyed by domain; the tests check none overwrites another. */
export const ipcDomains = {
  app: appChannels,
  canvas: canvasChannels,
  clipboard: clipboardChannels,
  fonts: fontsChannels,
  media: mediaChannels,
  prefs: prefsChannels,
  project: projectChannels,
  site: siteChannels,
  templates: templatesChannels,
  ai: aiChannels,
  themes: themesChannels,
  preview: previewChannels,
  publish: publishChannels,
} as const;

/** Name of an entry in {@link ipcContract}. */
export type IpcName = keyof typeof ipcContract;

/** Arguments the renderer sends for an IPC call. */
export type IpcRequest<N extends IpcName> = z.infer<(typeof ipcContract)[N]["request"]>;

/** Value the main process returns for an IPC call. */
export type IpcResponse<N extends IpcName> = z.infer<(typeof ipcContract)[N]["response"]>;
