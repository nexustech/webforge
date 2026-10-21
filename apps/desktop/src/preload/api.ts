import type { WebforgeApi } from "../shared/webforge-api.js";
import { appApi } from "./api/app.js";
import { createCall, type Invoke, type Subscribe } from "./api/call.js";
import { canvasApi } from "./api/canvas.js";
import { mediaApi } from "./api/media.js";
import { prefsApi } from "./api/prefs.js";
import { projectApi } from "./api/project.js";
import { siteApi } from "./api/site.js";

export type { Invoke, Subscribe } from "./api/call.js";

/**
 * Builds the `window.webforge` API on top of an IPC `invoke` function. Each IPC domain has its
 * builder in `./api/<domain>.ts`.
 */
export function createWebforgeApi(invoke: Invoke, subscribe: Subscribe): WebforgeApi {
  const call = createCall(invoke);
  return {
    app: appApi(call, subscribe),
    canvas: canvasApi(call),
    media: mediaApi(call),
    prefs: prefsApi(call),
    project: projectApi(call),
    site: siteApi(call),
  };
}
