import type { RootOptions } from "react-dom/client";
import {
  type ErrorDetails,
  errorDetailsOf,
  type RendererErrorKind,
} from "../shared/error-details.js";

/** Reports an error the renderer met (R3): see {@link createErrorReporter}. */
export type ReportError = (kind: RendererErrorKind, error: unknown) => void;

/**
 * Sends the name and stack frames of each error, never its message, to the main process, which
 * writes a local crash report (`window.webforge.app.reportError`). Nothing is sent anywhere else,
 * and a report that fails is dropped: reporting must never cause another error.
 */
export function createErrorReporter(
  send: (kind: RendererErrorKind, error: ErrorDetails) => Promise<unknown>,
): ReportError {
  return (kind, error) => {
    send(kind, errorDetailsOf(error)).catch(() => undefined);
  };
}

/**
 * Reports what no code caught in `target` (the window): errors thrown by event handlers and
 * timers, and rejected promises nobody handled. Returns a function that stops.
 */
export function installErrorReporting(
  target: Pick<Window, "addEventListener" | "removeEventListener">,
  report: ReportError,
): () => void {
  const onError = (event: ErrorEvent) => report("uncaught-error", event.error);
  const onRejection = (event: PromiseRejectionEvent) => report("unhandled-rejection", event.reason);
  target.addEventListener("error", onError);
  target.addEventListener("unhandledrejection", onRejection);
  return () => {
    target.removeEventListener("error", onError);
    target.removeEventListener("unhandledrejection", onRejection);
  };
}

/**
 * A React root's error options: errors an error boundary caught (a panel or the canvas shows its
 * fallback) and errors none did. `log` also shows each one while developing.
 */
export function rootErrorOptions(
  report: ReportError,
  log?: (error: unknown) => void,
): Pick<RootOptions, "onCaughtError" | "onUncaughtError"> {
  return {
    onCaughtError: (error) => {
      log?.(error);
      report("render-error", error);
    },
    onUncaughtError: (error) => {
      log?.(error);
      report("uncaught-error", error);
    },
  };
}
