import { type PreviewApi, previewEvents } from "../../shared/ipc/preview.js";
import type { Call, Subscribe } from "./call.js";

/** `window.webforge.preview`. */
export const previewApi = (call: Call, subscribe: Subscribe): PreviewApi => ({
  open: (sessionId, site, page) => call("previewOpen", sessionId, site, page),
  update: (sessionId, site) => call("previewUpdate", sessionId, site),
  show: (page) => call("previewShow", page),
  phone: (sessionId, site, page) => call("previewPhone", sessionId, site, page),
  stopPhone: () => call("previewStopPhone"),
  onPhoneStopped: (listener) =>
    subscribe(previewEvents.phoneStopped.channel, (...args) => {
      if (previewEvents.phoneStopped.args.safeParse(args).success) listener();
    }),
});
