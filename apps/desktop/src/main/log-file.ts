import electronLog from "electron-log/main";
import type { LogSink } from "./log.js";

/** The most the log file takes before it is rotated (one older copy is kept, `main.old.log`). */
const MAX_LOG_BYTES = 1024 * 1024;

/**
 * The app's log file, by electron-log (standards §1, §4): `main.log` in the operating system's
 * log folder for the app (`%APPDATA%\Webforge\logs` on Windows, `~/Library/Logs/Webforge` on
 * macOS), at most 1 MB and one older copy. Lines also go to the console while developing.
 */
export function fileLogSink(packaged: boolean): LogSink {
  electronLog.transports.file.maxSize = MAX_LOG_BYTES;
  electronLog.transports.file.format = "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}";
  electronLog.transports.console.level = packaged ? false : "info";
  return (level, line) => electronLog[level](line);
}
