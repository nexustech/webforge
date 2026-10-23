import { z } from "zod";

/** At most this many stack frames go into a crash report. */
export const MAX_FRAMES = 30;

/** At most this many characters of one frame (a minified bundle can have long ones). */
const MAX_FRAME_LENGTH = 500;

/** An error's name as crash reports keep it: `TypeError`, `DOMException`, `string`… */
const ERROR_NAME = /^[\w$.]{1,64}$/;

/**
 * A V8 stack frame: `at fn (location:1:2)`, `at location:1:2`, or a built-in's `(<anonymous>)` or
 * `(native)`. Anything else on an `at ` line is message text that happens to start that way (a
 * message can span lines), which may quote site content.
 */
const STACK_FRAME = /^at .+(?::\d+:\d+\)?|\((?:<anonymous>|native)\))$/;

/** Whether a trimmed stack line is a frame (see {@link STACK_FRAME}), not part of the message. */
export function isStackFrame(line: string): boolean {
  return line.length <= MAX_FRAME_LENGTH && STACK_FRAME.test(line);
}

/**
 * What another process may tell the main process about an error (F-SITE-7, R3): its name and stack
 * frames, never its message, which can quote whatever the code was working on. The main process
 * still treats them as untrusted: it removes paths from the frames before writing a report.
 */
export const errorDetailsSchema = z.strictObject({
  name: z.string().regex(ERROR_NAME),
  frames: z.array(z.string().max(MAX_FRAME_LENGTH)).max(MAX_FRAMES),
});

/** See {@link errorDetailsSchema}. */
export type ErrorDetails = z.infer<typeof errorDetailsSchema>;

/** The name and frames of whatever was thrown: an `Error`'s, or just the type of anything else. */
export function errorDetailsOf(error: unknown): ErrorDetails {
  if (!(error instanceof Error)) {
    return { name: typeof error, frames: [] };
  }
  return {
    name: ERROR_NAME.test(error.name) ? error.name : "Error",
    frames: (error.stack ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(isStackFrame)
      .slice(0, MAX_FRAMES),
  };
}

/** How an error in the renderer surfaced (R3). */
export const rendererErrorKindSchema = z.enum([
  // Caught by an error boundary: a panel or the canvas shows its fallback, the rest keeps working.
  "render-error",
  // Thrown while rendering outside any boundary, or in an event handler or timer.
  "uncaught-error",
  "unhandled-rejection",
]);

/** See {@link rendererErrorKindSchema}. */
export type RendererErrorKind = z.infer<typeof rendererErrorKindSchema>;

/**
 * What a utility process (the export worker) posts just before it exits after an error nothing
 * caught (R3), so the main process can write a crash report with the frames.
 */
export const workerCrashSchema = z.strictObject({
  type: z.literal("crashed"),
  kind: z.enum(["uncaught-exception", "unhandled-rejection"]),
  error: errorDetailsSchema,
});

/** See {@link workerCrashSchema}. */
export type WorkerCrash = z.infer<typeof workerCrashSchema>;
