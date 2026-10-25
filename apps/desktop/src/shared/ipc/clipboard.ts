import {
  type CopiedElements,
  copiedElementsSchema,
  mediaMetaSchema,
  webUrlSchema,
} from "@webforge/model";
import { z } from "zod";
import { rejectedFileSchema } from "./media.js";
import { sessionIdSchema } from "./project.js";

/**
 * The most bytes of copied text read as a web address (F-ED-16): far more than a video's address,
 * and not so much that a long text is read only to be left out.
 */
export const MAX_ADDRESS_BYTES = 2048;

/** Outcome of a copy: the elements are on the system clipboard, with their images kept aside. */
const writeResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("copied") }),
  z.strictObject({
    status: z.literal("failed"),
    /** `stale-session`: another site opened since the renderer loaded (R6). */
    reason: z.enum(["no-site", "stale-session", "unknown"]),
  }),
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
  /**
   * Image files copied in the file manager, or a copied image (a screenshot), imported into the
   * open site's file as for a drop: the renderer adds the items to Media and places them, as one
   * step. Files Media doesn't take are listed in `rejected`.
   */
  z.strictObject({
    status: z.literal("media"),
    items: z.array(mediaMetaSchema),
    rejected: z.array(rejectedFileSchema),
  }),
  /**
   * Copied text that is one web address (F-ED-16): the renderer places an Embed video if it is a
   * video's, YouTube or Vimeo.
   */
  z.strictObject({ status: z.literal("address"), address: webUrlSchema.max(MAX_ADDRESS_BYTES) }),
  /** The clipboard holds nothing Webforge can paste (nothing, text, or another app's data). */
  z.strictObject({ status: z.literal("empty") }),
  z.strictObject({
    status: z.literal("failed"),
    reason: z.enum(["no-site", "stale-session", "read-only", "unknown"]),
  }),
]);

/** Outcome of reading the clipboard. */
export type ClipboardReadResult = z.infer<typeof readResultSchema>;

/** IPC channels of the `clipboard` domain (`clipboard:*`). */
export const clipboardChannels = {
  /** Puts copied elements on the system clipboard, keeping their images for a later paste. */
  writeClipboard: {
    channel: "clipboard:write",
    request: z.tuple([sessionIdSchema, copiedElementsSchema]),
    response: writeResultSchema,
  },
  /**
   * What the system clipboard holds for a paste: Webforge's elements, their images stored in the
   * open site; else image files or an image, imported into it; else a copied web address.
   */
  readClipboard: {
    channel: "clipboard:read",
    request: z.tuple([sessionIdSchema]),
    response: readResultSchema,
  },
} as const;

/** `window.webforge.clipboard`. */
export interface ClipboardApi {
  /** Copies elements (F-ED-16), to paste on any page of this site or another one opened later. */
  write(sessionId: string, elements: CopiedElements): Promise<ClipboardWriteResult>;
  /**
   * Reads copied elements, image files, an image or a web address for a paste; images it imports go
   * into the open site only if it is still the opening `sessionId` names.
   */
  read(sessionId: string): Promise<ClipboardReadResult>;
}
