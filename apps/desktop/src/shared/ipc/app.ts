import { z } from "zod";

/** Information about the running app. */
const appInfoSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
});

/** Information about the running app. */
export type AppInfo = z.infer<typeof appInfoSchema>;

/** IPC channels of the `app` domain (`app:*`). */
export const appChannels = {
  getAppInfo: {
    channel: "app:get-info",
    request: z.tuple([]),
    response: appInfoSchema,
  },
} as const;

/**
 * Messages the main process sends to the renderer (the only direction `invoke` can't cover). Each
 * names its channel and the schema of its arguments, which the preload script checks.
 */
export const appEvents = {
  /**
   * The window is closing: save now. The argument is a request id; the renderer answers with
   * `project:flushed` and that id once everything is saved.
   */
  flushRequest: { channel: "app:flush", args: z.tuple([z.int().positive()]) },
} as const;

/** `window.webforge.app`. */
export interface AppApi {
  /** Returns the app name and version. */
  getInfo(): Promise<AppInfo>;
  /**
   * Runs `save` whenever the window is about to close, and tells the main process once it has
   * finished (or failed), so the window can close. Returns a function that stops listening.
   */
  onFlushRequest(save: () => Promise<void>): () => void;
}
