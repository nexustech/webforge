import { z } from "zod";

/** Information about the running app. */
const appInfoSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
});

/** Information about the running app. */
export type AppInfo = z.infer<typeof appInfoSchema>;

/**
 * The single list of IPC channels between the renderer and the main process.
 * Each entry names its channel and the zod schemas for the request arguments and the response.
 * The main process validates every incoming request against `request`; no channel exists outside
 * this contract.
 */
export const ipcContract = {
  getAppInfo: {
    channel: "app:get-info",
    request: z.tuple([]),
    response: appInfoSchema,
  },
} as const;

/** Name of an entry in {@link ipcContract}. */
export type IpcName = keyof typeof ipcContract;

/** Arguments the renderer sends for an IPC call. */
export type IpcRequest<N extends IpcName> = z.infer<(typeof ipcContract)[N]["request"]>;

/** Value the main process returns for an IPC call. */
export type IpcResponse<N extends IpcName> = z.infer<(typeof ipcContract)[N]["response"]>;
