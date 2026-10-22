import { type CopiedElements, copiedElementsSchema } from "@webforge/model";
import { z } from "zod";

/** Outcome of a copy: the elements are on the system clipboard, with their images kept aside. */
const writeResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("copied") }),
  z.strictObject({ status: z.literal("failed"), reason: z.enum(["no-site", "unknown"]) }),
]);

/** Outcome of a copy. */
export type ClipboardWriteResult = z.infer<typeof writeResultSchema>;

/**
 * Outcome of reading the clipboard for a paste. Copied images the open site doesn't have yet are
 * stored in its file first, so the renderer only adds their Media items, in the paste's undo step.
 * An image whose bytes are no longer kept is left out of `media`; the element then shows none.
 */
const readResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("elements"), elements: copiedElementsSchema }),
  /** The clipboard holds no Webforge elements (nothing, text, or something from another app). */
  z.strictObject({ status: z.literal("empty") }),
  z.strictObject({
    status: z.literal("failed"),
    reason: z.enum(["no-site", "read-only", "unknown"]),
  }),
]);

/** Outcome of reading the clipboard. */
export type ClipboardReadResult = z.infer<typeof readResultSchema>;

/** IPC channels of the `clipboard` domain (`clipboard:*`). */
export const clipboardChannels = {
  /** Puts copied elements on the system clipboard, keeping their images for a later paste. */
  writeClipboard: {
    channel: "clipboard:write",
    request: z.tuple([copiedElementsSchema]),
    response: writeResultSchema,
  },
  /** The elements on the system clipboard, their images stored in the open site. */
  readClipboard: {
    channel: "clipboard:read",
    request: z.tuple([]),
    response: readResultSchema,
  },
} as const;

/** `window.webforge.clipboard`. */
export interface ClipboardApi {
  /** Copies elements (F-ED-16), to paste on any page of this site or another one opened later. */
  write(elements: CopiedElements): Promise<ClipboardWriteResult>;
  /** Reads copied elements for a paste. */
  read(): Promise<ClipboardReadResult>;
}
