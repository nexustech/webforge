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

/** `window.webforge.app`. */
export interface AppApi {
  /** Returns the app name and version. */
  getInfo(): Promise<AppInfo>;
}
