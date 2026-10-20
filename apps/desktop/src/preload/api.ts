import type { WebforgeApi } from "../shared/webforge-api.js";
import { appApi } from "./api/app.js";
import { createCall, type Invoke } from "./api/call.js";
import { canvasApi } from "./api/canvas.js";
import { projectApi } from "./api/project.js";
import { siteApi } from "./api/site.js";

export type { Invoke } from "./api/call.js";

/**
 * Builds the `window.webforge` API on top of an IPC `invoke` function. Each IPC domain has its
 * builder in `./api/<domain>.ts`.
 */
export function createWebforgeApi(invoke: Invoke): WebforgeApi {
  const call = createCall(invoke);
  return {
    app: appApi(call),
    canvas: canvasApi(call),
    project: projectApi(call),
    site: siteApi(call),
  };
}
