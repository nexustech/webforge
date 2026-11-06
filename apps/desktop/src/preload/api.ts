import type { WebforgeApi } from "../shared/webforge-api.js";
import { aiApi } from "./api/ai.js";
import { appApi } from "./api/app.js";
import { createCall, type Invoke, type Subscribe } from "./api/call.js";
import { canvasApi } from "./api/canvas.js";
import { clipboardApi } from "./api/clipboard.js";
import { fontsApi } from "./api/fonts.js";
import { mediaApi, type PathOfFile } from "./api/media.js";
import { prefsApi } from "./api/prefs.js";
import { previewApi } from "./api/preview.js";
import { projectApi } from "./api/project.js";
import { publishApi } from "./api/publish.js";
import { siteApi } from "./api/site.js";
import { templatesApi } from "./api/templates.js";
import { themesApi } from "./api/themes.js";
import { trustApi } from "./api/trust.js";
import { versionsApi } from "./api/versions.js";

export type { Invoke, Subscribe } from "./api/call.js";
export type { PathOfFile } from "./api/media.js";

/**
 * Builds the `window.webforge` API on top of an IPC `invoke` function. Each IPC domain has its
 * builder in `./api/<domain>.ts`. `pathOf` finds a dropped file's path, for the main process only.
 */
export function createWebforgeApi(
  invoke: Invoke,
  subscribe: Subscribe,
  pathOf: PathOfFile = () => "",
): WebforgeApi {
  const call = createCall(invoke);
  return {
    ai: aiApi(call, subscribe),
    app: appApi(call, subscribe),
    canvas: canvasApi(call),
    clipboard: clipboardApi(call),
    fonts: fontsApi(call),
    media: mediaApi(call, pathOf),
    prefs: prefsApi(call),
    project: projectApi(call),
    site: siteApi(call, subscribe),
    templates: templatesApi(call),
    themes: themesApi(call),
    preview: previewApi(call, subscribe),
    publish: publishApi(call),
    trust: trustApi(call),
    versions: versionsApi(call),
  };
}
