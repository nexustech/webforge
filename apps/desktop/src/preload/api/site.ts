import { type SiteApi, siteEvents } from "../../shared/ipc/site.js";
import type { Call, Subscribe } from "./call.js";

/** `window.webforge.site`. */
export const siteApi = (call: Call, subscribe: Subscribe): SiteApi => ({
  export: (request) => call("exportSite", request),
  cancelExport: () => call("cancelExport"),
  onExportProgress: (listener) =>
    subscribe(siteEvents.exportProgress.channel, (...args) => {
      const parsed = siteEvents.exportProgress.args.safeParse(args);
      if (parsed.success) listener(parsed.data[0]);
    }),
});
