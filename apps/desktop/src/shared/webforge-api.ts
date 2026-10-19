import type { SiteSnapshot } from "@webforge/model";
import type { AppInfo, ExportResult, ProjectResult, ProjectSummary } from "./ipc-contract.js";

/**
 * The typed API the preload script exposes to the renderer as `window.webforge`.
 * The renderer reaches the main process only through this object.
 */
export interface WebforgeApi {
  readonly app: {
    /** Returns the app name and version. */
    getInfo(): Promise<AppInfo>;
  };
  readonly project: {
    /** Shows a save dialog, then creates the site there and opens it. */
    create(): Promise<ProjectResult>;
    /** Shows an open dialog, then opens the chosen site. */
    open(): Promise<ProjectResult>;
    /** The site that is open, or `null`. */
    getCurrent(): Promise<ProjectSummary | null>;
  };
  readonly site: {
    /** Shows a folder dialog, then builds the site and writes it there. */
    export(snapshot: SiteSnapshot): Promise<ExportResult>;
  };
}
