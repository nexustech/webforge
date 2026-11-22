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
/** Sends log lines to `next` from now on (the app's log file once it has started), or to the console. */
export declare function setLogSink(next?: LogSink): void;
/** The line for `event` and its context: `Webforge could not save the site (code=Error EIO)`. */
export declare function logLine(event: string, context?: LogContext): string;
/**
 * The main process's log (standards §4): `log.error("Webforge could not save the site", { code })`.
 * The event is a fixed sentence from the code, never built from data; the context holds codes
 * only (see {@link LogContext}).
 */
export declare const log: {
  info: (event: string, context?: LogContext) => void;
  warn: (event: string, context?: LogContext) => void;
  error: (event: string, context?: LogContext) => void;
};
/** Logs that `event` failed with `error`: its name and code only (`errorCode`), never its message. */
export declare function logFailure(event: string, error: unknown, context?: LogContext): void;
//# sourceMappingURL=log.d.ts.map
