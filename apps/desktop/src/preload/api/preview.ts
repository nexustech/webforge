import type { PreviewApi } from "../../shared/ipc/preview.js";
import type { Call } from "./call.js";

/** `window.webforge.preview`. */
export const previewApi = (call: Call): PreviewApi => ({
  open: (site, page) => call("previewOpen", site, page),
  update: (site) => call("previewUpdate", site),
  show: (page) => call("previewShow", page),
  phone: (site, page) => call("previewPhone", site, page),
});
