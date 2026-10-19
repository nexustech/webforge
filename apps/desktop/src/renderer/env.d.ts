import type { WebforgeApi } from "../shared/webforge-api.js";

declare global {
  interface Window {
    /** Typed API exposed by the preload script; the renderer's only route to the main process. */
    readonly webforge: WebforgeApi;
  }
}
