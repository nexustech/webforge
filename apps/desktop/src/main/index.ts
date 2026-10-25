import { Worker } from "node:worker_threads";
import * as electron from "electron";
import { startApp } from "./app.js";
import { startCrashReports } from "./crash-wiring.js";
import { setLogSink } from "./log.js";
import { fileLogSink } from "./log-file.js";
import { recoveryDialogs } from "./recovery-dialogs.js";

// The entry point only (R13c): the app's wiring is app.ts, tested against a fake Electron. Here
// are the real one and the modules that use it directly, which E2E tests cover.

// From the first moment, logs go to the app's log file (standards §4): codes only, never content.
setLogSink(fileLogSink(electron.app.isPackaged));

// Not awaited: Electron emits "ready" only after this module has finished evaluating.
void startApp(electron, {
  dir: import.meta.dirname,
  startCrashReports,
  recoveryDialogs,
  startStorageWriter: (script) => new Worker(script),
});
