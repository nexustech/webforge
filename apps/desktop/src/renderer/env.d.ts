import type { HelpWindowApi } from "../shared/ipc/help.js";
import type { WebforgeApi } from "../shared/webforge-api.js";

declare global {
  interface Window {
    /** Typed API exposed by the preload script; the renderer's only route to the main process. */
    readonly webforge: WebforgeApi;
    /** The Help window's whole API, from its own preload (5.4b); only on the Help page. */
    readonly webforgeHelp?: HelpWindowApi;
  }
}
