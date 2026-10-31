import type { PreviewApi } from "../../shared/ipc/preview.js";
import type { Call } from "./call.js";

/** `window.webforge.preview`. */
export const previewApi = (call: Call): PreviewApi => ({
  open: (sessionId, site, page) => call("previewOpen", sessionId, site, page),
  update: (sessionId, site) => call("previewUpdate", sessionId, site),
  show: (page) => call("previewShow", page),
  phone: (sessionId, site, page) => call("previewPhone", sessionId, site, page),
  stopPhone: () => call("previewStopPhone"),
});
