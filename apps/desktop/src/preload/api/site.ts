import type { SiteApi } from "../../shared/ipc/site.js";
import type { Call } from "./call.js";

/** `window.webforge.site`. */
export const siteApi = (call: Call): SiteApi => ({
  export: (request) => call("exportSite", request),
});
