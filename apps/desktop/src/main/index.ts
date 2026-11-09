import { Worker } from "node:worker_threads";
import * as electron from "electron";
import { startApp } from "./app.js";
import { startCrashReports } from "./crash-wiring.js";
import { setLogSink } from "./log.js";
import { fileLogSink } from "./log-file.js";
import { recoveryDialogs } from "./recovery-dialogs.js";
import { e2eUpdateFeed, electronUpdater } from "./updates.js";

// The entry point only (R13c): the app's wiring is app.ts, tested against a fake Electron. Here
// are the real one and the modules that use it directly, which E2E tests cover.

// From the first moment, logs go to the app's log file (standards §4): codes only, never content.
setLogSink(fileLogSink(electron.app.isPackaged, electron.app.getPath("logs")));

// Not awaited: Electron emits "ready" only after this module has finished evaluating.
void startApp(electron, {
  dir: import.meta.dirname,
  startCrashReports,
  recoveryDialogs,
  startStorageWriter: (script) => new Worker(script),
  // Windows only for now (`updatesSupported`), where electron-updater's own is NSIS's.
  updater: async () => {
    const { NsisUpdater } = await import("electron-updater");
    const nsis = new NsisUpdater();
    // The packaged update test's local feed, in an e2e build only (ADR 0024). The comparison is
    // with the build's mode, which the bundler fills in, so any other build drops the call.
    const feed =
      import.meta.env.MODE === "e2e" ? e2eUpdateFeed(import.meta.env.MODE, process.env) : undefined;
    if (feed !== undefined) nsis.setFeedURL({ provider: "generic", url: feed });
    return electronUpdater(nsis);
  },
});
