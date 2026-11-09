import { type UpdatesApi, updatesEvents } from "../../shared/ipc/updates.js";
import type { Call, Subscribe } from "./call.js";

/** `window.webforge.updates`. */
export const updatesApi = (call: Call, subscribe: Subscribe): UpdatesApi => ({
  status: () => call("updatesStatus"),
  onStatus: (listener) =>
    subscribe(updatesEvents.status.channel, (...args) => {
      const parsed = updatesEvents.status.args.safeParse(args);
      if (parsed.success) listener(parsed.data[0]);
    }),
});
