import type { AiApi } from "./ipc/ai.js";
import type { AppApi } from "./ipc/app.js";
import type { CanvasApi } from "./ipc/canvas.js";
import type { ClipboardApi } from "./ipc/clipboard.js";
import type { FontsApi } from "./ipc/fonts.js";
import type { MediaApi } from "./ipc/media.js";
import type { PrefsApi } from "./ipc/prefs.js";
import type { PreviewApi } from "./ipc/preview.js";
import type { ProjectApi } from "./ipc/project.js";
import type { SiteApi } from "./ipc/site.js";
import type { TemplatesApi } from "./ipc/templates.js";
import type { ThemesApi } from "./ipc/themes.js";

/**
 * The typed API the preload script exposes to the renderer as `window.webforge`.
 * The renderer reaches the main process only through this object. Each key is one IPC domain
 * (`./ipc/<domain>.ts`).
 */
export interface WebforgeApi {
  readonly app: AppApi;
  readonly canvas: CanvasApi;
  readonly clipboard: ClipboardApi;
  readonly fonts: FontsApi;
  readonly media: MediaApi;
  readonly prefs: PrefsApi;
  readonly project: ProjectApi;
  readonly site: SiteApi;
  readonly templates: TemplatesApi;
  readonly ai: AiApi;
  readonly themes: ThemesApi;
  readonly preview: PreviewApi;
}
