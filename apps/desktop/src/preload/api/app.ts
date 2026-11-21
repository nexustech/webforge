import { type AppApi, appEvents } from "../../shared/ipc/app.js";
import type { Call, Subscribe } from "./call.js";

/** `window.webforge.app`. */
export const appApi = (call: Call, subscribe: Subscribe): AppApi => ({
  getInfo: () => call("getAppInfo"),
  openCrashReports: () => call("openCrashReports"),
  reportError: (kind, error) => call("reportError", kind, error),
  logFailure: (context, code) => call("logFailure", context, code),
  recordUsage: (usage) => call("recordUsage", usage),
  openGuide: (guide) => call("openGuide", guide),
  listLicences: () => call("listLicences"),
  openChromiumLicences: () => call("openChromiumLicences"),
  setSpellCheckLanguage: (language) => call("setSpellCheckLanguage", language),
  getReportInfo: () => call("getReportInfo"),
  openReport: (route, text) => call("openReport", route, text),
  captureWindow: () => call("captureWindow"),
  saveWindowCapture: () => call("saveWindowCapture"),
  discardWindowCapture: () => call("discardWindowCapture"),
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
  onSitePicture: (draw, done) =>
    subscribe(appEvents.sitePicture.channel, (...args) => {
      const parsed = appEvents.sitePicture.args.safeParse(args);
      if (!parsed.success) return;
      const [id, step] = parsed.data;
      if (step === "done") {
        done();
        return;
      }
      // Answer even if drawing failed: the main process then takes no picture.
      void draw()
        .catch(() => false)
        .then((drawn) => call("sitePictureDrawn", id, drawn));
    }),
});
