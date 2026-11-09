import { z } from "zod";

/**
 * Where Webforge's own update is (0.5a): none found (`idle`), one found and downloading in the
 * background (`available`), downloaded and installing when Webforge closes (`downloaded`), or the
 * last check or download failed (`error`, logged by its code in main and otherwise never shown).
 * `version` is the update's, as its release names it.
 */
const updateStatusSchema = z.strictObject({
  state: z.enum(["idle", "available", "downloaded", "error"]),
  version: z
    .string()
    .max(64)
    .regex(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/)
    .optional(),
});

/** See {@link updateStatusSchema}. */
export type UpdateStatus = z.infer<typeof updateStatusSchema>;

/** IPC channels of the `updates` domain (`updates:*`). Each one's arguments are checked. */
export const updatesChannels = {
  /** The update's state now, for a window that opens after main last said. */
  updatesStatus: {
    channel: "updates:status",
    request: z.tuple([]),
    response: updateStatusSchema,
  },
} as const;

/** Messages the main process sends the editor window. Its preload checks each one's arguments. */
export const updatesEvents = {
  /** The update's state changed. */
  status: { channel: "updates:status-changed", args: z.tuple([updateStatusSchema]) },
} as const;

/** `window.webforge.updates`. */
export interface UpdatesApi {
  /** The update's state now. */
  status(): Promise<UpdateStatus>;
  /** Calls `listener` whenever the update's state changes. Returns a stop function. */
  onStatus(listener: (status: UpdateStatus) => void): () => void;
}
