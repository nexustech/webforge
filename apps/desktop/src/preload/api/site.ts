import { type SiteApi, siteEvents } from "../../shared/ipc/site.js";
import type { Call, Subscribe } from "./call.js";

/** `window.webforge.site`. */
export const siteApi = (call: Call, subscribe: Subscribe): SiteApi => ({
  export: (sessionId, request, operationId) => call("exportSite", sessionId, request, operationId),
  exportChoices: (sessionId) => call("exportChoices", sessionId),
  setExportChoices: (sessionId, choices) => call("setExportChoices", sessionId, choices),
  openExport: (sessionId) => call("openExport", sessionId),
  cancelExport: (operationId) => call("cancelExport", operationId),
  bundleFile: (sessionId, url) => call("bundleFile", sessionId, url),
  onExportProgress: (listener) =>
    subscribe(siteEvents.exportProgress.channel, (...args) => {
      const parsed = siteEvents.exportProgress.args.safeParse(args);
      if (parsed.success) listener(parsed.data[0], parsed.data[1]);
    }),
});
