import { errorCode } from "@webforge/errors";

/** How serious a log line is. */
export type LogLevel = "info" | "warn" | "error";

/**
 * What a log line says beyond its event: short codes and counts (`code: "SQLITE_BUSY"`,
 * `channel: "project:commit"`, `files: 12`). Never a path, site content, a credential or anything
 * else a person typed or chose. As a safety net, a string value that isn't a short plain token
 * (a path, a URL, a sentence) is written as `[redacted]`; a token-shaped secret can't be told from
 * a code, so callers pass codes only.
 */
export type LogContext = Readonly<Record<string, string | number | boolean | undefined>>;

/** Where log lines go. */
export type LogSink = (level: LogLevel, line: string) => void;

/** The console, until the app sends lines to its log file (`log-file.ts`); tests keep it. */
const consoleSink: LogSink = (level, line) => {
  // The one place the main process writes to the console (standards §4).
  console[level](line);
};

let sink: LogSink = consoleSink;

/** Sends log lines to `next` from now on (the app's log file once it has started), or to the console. */
export function setLogSink(next: LogSink = consoleSink): void {
  sink = next;
}

/** A context value as a log may hold it: letters, digits and `_ . : @ -`, short. */
const SAFE_VALUE = /^[A-Za-z0-9_.:@-]{0,80}$/;

/** `value` as it is written to the log: a plain token as it is, anything else redacted. */
function logValue(value: string | number | boolean): string {
  if (typeof value !== "string") return String(value);
  // An error code may hold one space ("ProjectFileError corrupt"); nothing else may.
  const [first = "", second, ...rest] = value.split(" ");
  const tokens = second === undefined ? [first] : [first, second];
  return rest.length === 0 && tokens.every((token) => SAFE_VALUE.test(token))
    ? value
    : "[redacted]";
}

/** The line for `event` and its context: `Webforge could not save the site (code=Error EIO)`. */
export function logLine(event: string, context: LogContext = {}): string {
  const details = Object.entries(context)
    .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
    .map(([key, value]) => `${key}=${logValue(value)}`);
  return details.length === 0 ? event : `${event} (${details.join(", ")})`;
}

/**
 * The main process's log (standards §4): `log.error("Webforge could not save the site", { code })`.
 * The event is a fixed sentence from the code, never built from data; the context holds codes
 * only (see {@link LogContext}).
 */
export const log = {
  info: (event: string, context?: LogContext) => sink("info", logLine(event, context)),
  warn: (event: string, context?: LogContext) => sink("warn", logLine(event, context)),
  error: (event: string, context?: LogContext) => sink("error", logLine(event, context)),
};

/** Logs that `event` failed with `error`: its name and code only (`errorCode`), never its message. */
export function logFailure(event: string, error: unknown, context?: LogContext): void {
  log.error(event, { ...context, code: errorCode(error) });
}
