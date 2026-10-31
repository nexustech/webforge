import { type FileMimeType, type IMAGE_MIME_TYPES, sniffImage } from "@webforge/model";
import { sniffDocument } from "./document-files.js";

/** What an imported file turned out to be, from its bytes rather than its name. */
export type SniffedMedia =
  | {
      readonly kind: "image";
      readonly mimeType: (typeof IMAGE_MIME_TYPES)[number];
      readonly width: number;
      readonly height: number;
    }
  | { readonly kind: "file"; readonly mimeType: FileMimeType };

/** Whether `bytes` start as a PNG or a JPEG does. */
const looksLikeImage = (bytes: Uint8Array) =>
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte) ||
  (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff);

/**
 * Recognises the files Media accepts: JPEG and PNG images by their first bytes, with their size,
 * and documents (PDF, Office, OpenDocument, text and CSV) by their extension and their bytes
 * together ({@link sniffDocument}). Anything else, a truncated header or an image without a size,
 * is `undefined`.
 */
export function sniffMedia(bytes: Uint8Array, fileName: string): SniffedMedia | undefined {
  const image = sniffImage(bytes);
  if (image !== undefined) return { kind: "image", ...image };
  // A PNG or JPEG without a size it can read is no file Media takes.
  if (looksLikeImage(bytes)) return undefined;
  const document = sniffDocument(bytes, fileName);
  return document === undefined ? undefined : { kind: "file", mimeType: document };
}
