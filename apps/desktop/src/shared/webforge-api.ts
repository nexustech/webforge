import type { AppApi } from "./ipc/app.js";
import type { ProjectApi } from "./ipc/project.js";
import type { SiteApi } from "./ipc/site.js";

/**
 * The typed API the preload script exposes to the renderer as `window.webforge`.
 * The renderer reaches the main process only through this object. Each key is one IPC domain
 * (`./ipc/<domain>.ts`).
 */
export interface WebforgeApi {
  readonly app: AppApi;
  readonly project: ProjectApi;
  readonly site: SiteApi;
}
