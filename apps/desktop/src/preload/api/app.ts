import { type AppApi, appEvents } from "../../shared/ipc/app.js";
import type { Call, Subscribe } from "./call.js";

/** `window.webforge.app`. */
export const appApi = (call: Call, subscribe: Subscribe): AppApi => ({
  getInfo: () => call("getAppInfo"),
  onFlushRequest: (save) =>
    subscribe(appEvents.flushRequest.channel, (...args) => {
      const parsed = appEvents.flushRequest.args.safeParse(args);
      if (!parsed.success) {
        return;
      }
      const [id] = parsed.data;
      // Answer even if saving failed: the window must still be able to close.
      void save()
        .catch(() => undefined)
        .then(() => call("projectFlushed", id));
    }),
});
