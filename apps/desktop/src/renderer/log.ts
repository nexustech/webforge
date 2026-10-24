import { errorCode } from "@webforge/errors";

/** Sends a handled failure to the app's log: `window.webforge.app.logFailure`. */
type FailureLog = (context: string, code: string) => Promise<unknown>;

let failureLog: FailureLog | undefined;

/** Sends handled failures to `next` from now on (set once at start-up), or nowhere (tests). */
export function setFailureLog(next: FailureLog | undefined): void {
  failureLog = next;
}

/**
 * Logs a failure the editor handled (R12, standards §4): where it happened (`clipboard.paste`,
 * `command.edit.undo`) and the error's name and code (`errorCode`), never its message, which may
 * hold a path or site content. Logging never fails the caller.
 */
export function reportFailure(context: string, error: unknown): void {
  failureLog?.(context, errorCode(error)).catch(() => undefined);
}

/** Shows an error in the developer tools' console: while developing only (the renderer's one). */
export function showInDevConsole(error: unknown): void {
  console.error(error);
}
