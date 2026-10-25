import { type AppApi, appEvents } from "../../shared/ipc/app.js";
import type { Call, Subscribe } from "./call.js";

/** `window.webforge.app`. */
export const appApi = (call: Call, subscribe: Subscribe): AppApi => ({
  getInfo: () => call("getAppInfo"),
  openCrashReports: () => call("openCrashReports"),
  reportError: (kind, error) => call("reportError", kind, error),
  logFailure: (context, code) => call("logFailure", context, code),
  setSpellCheckLanguage: (language) => call("setSpellCheckLanguage", language),
  setNativeMenus: (menus) => call("setNativeMenus", menus),
  onRunCommand: (run) =>
    subscribe(appEvents.runCommand.channel, (...args) => {
      const parsed = appEvents.runCommand.args.safeParse(args);
      if (parsed.success) run(parsed.data[0]);
    }),
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
