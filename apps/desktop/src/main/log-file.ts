import { join } from "node:path";
import electronLog from "electron-log/node";
import type { LogSink } from "./log.js";

/** The most the log file takes before it is rotated (one older copy is kept, `main.old.log`). */
const MAX_LOG_BYTES = 1024 * 1024;

/**
 * The app's log file, by electron-log (standards §1, §4): `main.log` in `logsDir`, the operating
 * system's log folder for the app (`%APPDATA%\Webforge\logs` on Windows, `~/Library/Logs/Webforge`
 * on macOS, Electron's `app.getPath("logs")`), at most 1 MB and one older copy. Lines also go to
 * the console while developing. electron-log's Node logger, not its Electron one: that one opens
 * an IPC channel of its own, `__ELECTRON_LOG__`, with no sender check or schema, which writes
 * whatever it is sent into the file (security review S17, #655). Only the main process logs.
 */
export function fileLogSink(packaged: boolean, logsDir: string): LogSink {
  electronLog.transports.file.resolvePathFn = () => join(logsDir, "main.log");
  electronLog.transports.file.maxSize = MAX_LOG_BYTES;
  electronLog.transports.file.format = "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}";
  electronLog.transports.console.level = packaged ? false : "info";
  return (level, line) => electronLog[level](line);
}
