import type { AppInfo } from "./ipc-contract.js";

/**
 * The typed API the preload script exposes to the renderer as `window.webforge`.
 * The renderer reaches the main process only through this object.
 */
export interface WebforgeApi {
  readonly app: {
    /** Returns the app name and version. */
    getInfo(): Promise<AppInfo>;
  };
}
